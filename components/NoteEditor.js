"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createNote, deleteNote, updateNote } from "../lib/api";
import { apiUploadNoteImage } from "../lib/client-api";
import { mediaDisplayUrl } from "../lib/media-url";
import { resolveNoteTitleForSave } from "../lib/format";
import {
  applySpanEdit,
  applySpanEditsSequential,
  coalesceEditSpanCalls,
  extractSpanEditIntents,
  missingSpanInsertTexts,
  normalizeNoteKind,
  pickDraftPlain,
  sanitizeAiPlainText,
} from "../lib/ai-plain";
import {
  bodyToStorage,
  isBodyEmpty,
  kStoredQuill,
  plainTextFromBody,
} from "../lib/quill-body";
import {
  REMIND_OFFSET_PRESETS,
  formatRemindOffset,
  fromDatetimeLocalValue,
  isRecurringFreq,
  kRecurByDayCodes,
  kRecurDaily,
  kRecurMonthly,
  kRecurOnce,
  kRecurWeekly,
  kRecurYearly,
  normalizeRecurFreq,
  remindAtFromOffset,
  toDatetimeLocalValue,
  weekdayToByDay,
} from "../lib/note-recur";
import { useAuth } from "./AuthProvider";
import NoteAiPanel from "./NoteAiPanel";
import QuillEditorField from "./QuillEditorField";
import VoiceMicButton from "./VoiceMicButton";

function initialOffset(note, kind) {
  if (kind !== "schedule") return 0;
  if (note?.remindOffsetMin != null) return Number(note.remindOffsetMin);
  if (note?.remindAt == null && note?.scheduleAt) return -1;
  return 0;
}

export function kindNoun(kind) {
  switch (kind) {
    case "memo":
      return "备忘";
    case "schedule":
      return "日常";
    case "article":
      return "文章";
    case "admonition":
      return "谏言";
    default:
      return "笔记";
  }
}

export function kindActionLabel(kind) {
  switch (kind) {
    case "memo":
      return "添加";
    case "schedule":
      return "安排";
    case "article":
      return "发布";
    case "admonition":
      return "推荐";
    default:
      return "保存";
  }
}

export function kindHint(kind) {
  switch (kind) {
    case "memo":
      return "将笔记添加到备忘";
    case "schedule":
      return "将笔记安排到日常";
    case "article":
      return "将笔记发布到阅读";
    case "admonition":
      return "推荐到谏言";
    default:
      return "记录你的念头和思绪";
  }
}

function busyLabel(kind) {
  switch (kind) {
    case "memo":
      return "正在添加…";
    case "schedule":
      return "正在安排…";
    case "article":
      return "正在发布…";
    case "admonition":
      return "正在推荐…";
    default:
      return "正在保存…";
  }
}

const NoteEditor = forwardRef(function NoteEditor(
  {
    note = null,
    onCreated,
    onSaved,
    onDeleted,
    toast,
    initialScheduleAt = null,
    initialRemindAt = null,
    initialKind = null,
  },
  ref,
) {
  const { isAdmin } = useAuth();
  const editing = Boolean(note?.id);
  const defaultKind =
    note?.kind ||
    initialKind ||
    (initialScheduleAt ? "schedule" : "note");

  const [title, setTitle] = useState(note?.title || "");
  const [bodyOps, setBodyOps] = useState(null);
  // 可变 seed：AI 写入时同步，避免 imperative replace 失败或编辑器重挂载丢正文
  const [bodySeed, setBodySeed] = useState(note?.body || "");
  const [bodyFormat] = useState(note?.format || kStoredQuill);
  const [kind, setKind] = useState(defaultKind);
  const [city, setCity] = useState(note?.city || "");
  const [coverUrl, setCoverUrl] = useState(note?.coverUrl || "");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const quillRef = useRef(null);
  const editorLocked = busy || aiBusy;
  const micRef = useRef(null);
  const voiceInserting = useRef(false);
  const aiRefKey = note?.id || `draft:${defaultKind}`;

  function stopMicOnKeyboard() {
    if (voiceInserting.current) return;
    micRef.current?.stopIfActive?.();
  }

  const [scheduleLocal, setScheduleLocal] = useState(() =>
    toDatetimeLocalValue(
      note?.scheduleAt ||
        initialScheduleAt ||
        (defaultKind === "schedule" ? new Date() : null),
    ),
  );
  const [remindOffsetMin, setRemindOffsetMin] = useState(() =>
    initialOffset(note, defaultKind),
  );
  const [recurFreq, setRecurFreq] = useState(() =>
    normalizeRecurFreq(note?.recurFreq),
  );
  const [recurByday, setRecurByday] = useState(
    () => note?.recurByday || weekdayToByDay(new Date()),
  );
  const [recurEndMode, setRecurEndMode] = useState(() => {
    if (note?.recurUntil) return "until";
    if (note?.recurCount) return "count";
    return "never";
  });
  const [recurUntilLocal, setRecurUntilLocal] = useState(() => {
    if (!note?.recurUntil) return "";
    const d = new Date(note.recurUntil);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [recurCount, setRecurCount] = useState(
    () => (note?.recurCount != null ? String(note.recurCount) : "10"),
  );

  const lockedFromCal = !editing && Boolean(initialScheduleAt);
  const baselineRef = useRef("");
  const baselineReady = useRef(false);

  function plainNow() {
    if (quillRef.current?.getPlain) {
      return quillRef.current.getPlain() || "";
    }
    if (bodyOps) {
      return bodyOps
        .map((o) => (typeof o.insert === "string" ? o.insert : ""))
        .join("")
        .replace(/\n+$/, "");
    }
    return plainTextFromBody(bodySeed, bodyFormat);
  }

  function snapshot(overrides = {}) {
    return JSON.stringify({
      title: String(overrides.title ?? title ?? "").trim(),
      plain: String(overrides.plain ?? plainNow() ?? "").trim(),
      kind: overrides.kind ?? kind,
      city: String(overrides.city ?? city ?? "").trim(),
      coverUrl: String(overrides.coverUrl ?? coverUrl ?? "").trim(),
      scheduleLocal: overrides.scheduleLocal ?? scheduleLocal,
      remindOffsetMin: overrides.remindOffsetMin ?? remindOffsetMin,
      recurFreq: overrides.recurFreq ?? recurFreq,
      recurByday: overrides.recurByday ?? recurByday,
      recurEndMode: overrides.recurEndMode ?? recurEndMode,
      recurUntilLocal: overrides.recurUntilLocal ?? recurUntilLocal,
      recurCount: overrides.recurCount ?? recurCount,
    });
  }

  async function pickCover() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      try {
        const { url } = await apiUploadNoteImage(file, { kind: "covers" });
        if (!url) throw new Error("上传成功但未返回地址");
        setCoverUrl(url);
        toast?.("封面已更新");
      } catch (e) {
        toast?.(e.message || "封面上传失败");
      } finally {
        setBusy(false);
      }
    };
    input.click();
  }

  function markClean(overrides = {}) {
    baselineRef.current = snapshot(overrides);
    baselineReady.current = true;
  }

  function isDirty() {
    if (!baselineReady.current) return false;
    return snapshot() !== baselineRef.current;
  }

  useEffect(() => {
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      const quillReady = Boolean(quillRef.current?.getPlain);
      if (quillReady || tries >= 50) {
        markClean();
        window.clearInterval(id);
      }
    }, 100);
    return () => window.clearInterval(id);
    // 仅挂载时采基线（等 Quill 就绪，避免空正文基线导致误脏）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function optionsSnapshot() {
    return {
      kind,
      title,
      schedule_at: scheduleLocal
        ? fromDatetimeLocalValue(scheduleLocal)?.toISOString() || null
        : null,
      remind_at: (() => {
        if (kind !== "schedule") return null;
        const sched = fromDatetimeLocalValue(scheduleLocal);
        const r = remindAtFromOffset(sched, remindOffsetMin);
        return r ? r.toISOString() : null;
      })(),
      recur_freq: recurFreq,
      recur_byday: recurByday,
      recur_until:
        recurEndMode === "until" && recurUntilLocal
          ? `${recurUntilLocal}T23:59:00`
          : null,
      recur_count:
        recurEndMode === "count" ? parseInt(recurCount, 10) || null : null,
      remind_offset_min: remindOffsetMin,
      // 文章/谏言发布即可见
      listed: kind === "article" || kind === "admonition",
      city,
    };
  }

  function getDraft() {
    const plain =
      quillRef.current?.getPlain?.() ||
      (bodyOps
        ? bodyOps
            .map((o) => (typeof o.insert === "string" ? o.insert : ""))
            .join("")
            .replace(/\n+$/, "")
        : "");
    return {
      title,
      plain,
      options: optionsSnapshot(),
      optionsJson: JSON.stringify(optionsSnapshot()),
    };
  }

  function commitPlain(nextPlain) {
    const plain = String(nextPlain ?? "");
    const ops =
      quillRef.current?.replacePlain?.(plain) ||
      [
        {
          insert: plain.endsWith("\n") ? plain : `${plain}\n`,
        },
      ];
    setBodyOps(ops);
    setBodySeed(JSON.stringify(ops));
    return ops;
  }

  function applyTools(calls, { userText = "" } = {}) {
    const tips = [];
    // 同轮多次正文改动：先在本地 plain 上算完，最后只写回一次，避免中间态互相覆盖
    const plainBefore = plainNow() || "";
    let plainCursor = plainBefore;
    let bodyDirty = false;
    const queued = coalesceEditSpanCalls(calls || []);
    for (const call of queued) {
      const name = call.name;
      const args = call.args || {};
      switch (name) {
        case "set_title": {
          setTitle(String(args.title || "").trim());
          tips.push("已改标题");
          break;
        }
        case "append_draft": {
          const plain =
            pickDraftPlain(args) || sanitizeAiPlainText(args.plain || "");
          if (!plain) {
            tips.push("追加内容为空，未改动");
            break;
          }
          plainCursor = plainCursor.trim()
            ? `${plainCursor.trim()}\n${plain}`
            : plain;
          bodyDirty = true;
          tips.push("已追加正文");
          break;
        }
        case "edit_span": {
          const result = applySpanEdit(plainCursor, args);
          if (!result.ok) {
            tips.push(result.error || "局部编辑失败");
            break;
          }
          plainCursor = result.next;
          bodyDirty = true;
          tips.push(result.tip || "已局部编辑");
          break;
        }
        case "replace_draft": {
          const plain = pickDraftPlain(args) || sanitizeAiPlainText(args.plain || "");
          if (!plain) {
            tips.push("正文为空，未改动");
            break;
          }
          plainCursor = plain;
          bodyDirty = true;
          tips.push("已写入正文");
          break;
        }
        case "replace_delta": {
          if (Array.isArray(args.delta)) {
            if (bodyDirty) commitPlain(plainCursor);
            bodyDirty = false;
            const ops =
              quillRef.current?.replaceDelta?.(args.delta) || args.delta;
            setBodyOps(ops);
            setBodySeed(JSON.stringify(ops));
            plainCursor = plainNow() || plainCursor;
            tips.push("已按富文本写入正文");
          } else {
            tips.push("replace_delta 无效");
          }
          break;
        }
        case "apply_format": {
          quillRef.current?.applyFormat?.(args);
          tips.push("已套用格式");
          break;
        }
        case "set_note_options": {
          if (args.kind != null && String(args.kind).trim()) {
            const raw = String(args.kind).trim();
            const k = normalizeNoteKind(raw, { allowAdmonition: isAdmin });
            if (k) {
              setKind(k);
              if (k === "schedule" && !scheduleLocal) {
                setScheduleLocal(toDatetimeLocalValue(new Date()));
              }
            } else if (/admonition|谏言/i.test(raw) && !isAdmin) {
              tips.push("谏言仅管理员可设");
            } else {
              tips.push(`未识别的类型「${raw}」`);
            }
          }
          if (args.title != null) setTitle(String(args.title).trim());
          if (args.city != null) setCity(String(args.city).trim());
          if (args.schedule_at != null) {
            const raw = String(args.schedule_at || "").trim();
            if (!raw) setScheduleLocal("");
            else setScheduleLocal(toDatetimeLocalValue(args.schedule_at));
          }
          if (args.remind_at != null) {
            const raw = String(args.remind_at || "").trim();
            const asSchedule =
              String(args.kind || kind).trim() === "schedule";
            if (asSchedule) {
              if (!raw) {
                setRemindOffsetMin(-1);
              } else {
                const remind = new Date(raw);
                const sched =
                  fromDatetimeLocalValue(
                    args.schedule_at
                      ? toDatetimeLocalValue(args.schedule_at)
                      : scheduleLocal,
                  ) || null;
                if (!Number.isNaN(remind.getTime()) && sched) {
                  const mins = Math.round(
                    (sched.getTime() - remind.getTime()) / 60000,
                  );
                  setRemindOffsetMin(mins < 0 ? 0 : mins);
                }
              }
            }
          }
          if (args.recur_freq != null) {
            setRecurFreq(normalizeRecurFreq(args.recur_freq));
          }
          if (args.recur_byday != null) {
            setRecurByday(String(args.recur_byday).toUpperCase());
          }
          if (args.recur_until != null && String(args.recur_until).trim()) {
            setRecurEndMode("until");
            const d = new Date(args.recur_until);
            if (!Number.isNaN(d.getTime())) {
              const pad = (n) => String(n).padStart(2, "0");
              setRecurUntilLocal(
                `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
              );
            }
          } else if (args.recur_count != null) {
            setRecurEndMode("count");
            setRecurCount(String(args.recur_count));
          }
          if (args.remind_offset_min != null) {
            const m = Number(args.remind_offset_min);
            setRemindOffsetMin(Number.isFinite(m) && m < 0 ? -1 : m || 0);
          }
          // listed：文章/谏言保存时强制上架；AI 要求上架时切到文章
          if (args.listed != null) {
            const on =
              args.listed === true ||
              args.listed === 1 ||
              String(args.listed) === "true";
            if (on && kind !== "article" && kind !== "admonition") {
              setKind("article");
            }
          }
          tips.push("已更新笔记选项");
          break;
        }
        default:
          tips.push(`未知工具：${name}`);
      }
    }

    // 模型常漏掉「后面写」或误用 insert_before：按用户话术从改前正文确定性重放
    const intents = extractSpanEditIntents(userText);
    if (intents.length) {
      const missing = missingSpanInsertTexts(plainCursor, intents);
      if (missing.length) {
        const repaired = applySpanEditsSequential(plainBefore, intents);
        if (repaired.tips.length) {
          plainCursor = repaired.plain;
          bodyDirty = true;
          for (let i = tips.length - 1; i >= 0; i -= 1) {
            if (tipIsSpanEditSafe(tips[i])) tips.splice(i, 1);
          }
          tips.push(...repaired.tips);
        }
      }
    }

    if (bodyDirty) commitPlain(plainCursor);
    return tips;
  }

  function tipIsSpanEditSafe(tip) {
    return /已删除指定片段|已改写指定片段|已在指定句/.test(String(tip || ""));
  }

  async function handleDelete() {
    if (!editing || !note?.id || busy) return;
    const label = kindNoun(kind);
    const name = (title || "").trim() || label;
    if (!window.confirm(`确认删除「${name}」？`)) return;
    setBusy(true);
    try {
      await deleteNote(note.id);
      toast?.("已删除");
      onDeleted?.(note);
    } catch (e) {
      toast?.(e.message || "删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave({ silentEmpty = false, skipNavigate = false } = {}) {
    const ops = bodyOps ?? quillRef.current?.getOps?.() ?? null;
    const storedBody =
      ops != null
        ? bodyToStorage(ops)
        : bodySeed
          ? bodySeed.trim().startsWith("[")
            ? bodySeed
            : bodyToStorage([
                {
                  insert: bodySeed.endsWith("\n") ? bodySeed : `${bodySeed}\n`,
                },
              ])
          : bodyToStorage([{ insert: "\n" }]);
    if (!String(title).trim() && isBodyEmpty(ops ?? storedBody, kStoredQuill)) {
      if (silentEmpty) return null;
      toast?.(`请填写标题或正文`);
      throw new Error("请填写标题或正文");
    }
    if (
      (kind === "schedule" || kind === "article") &&
      !String(title).trim()
    ) {
      toast?.(kind === "schedule" ? "日常必须填写标题" : "文章必须填写标题");
      throw new Error("标题必填");
    }
    if (kind === "schedule") {
      const scheduleAt = fromDatetimeLocalValue(scheduleLocal);
      if (!scheduleAt) {
        toast?.("请填写日常时间");
        throw new Error("请填写日常时间");
      }
    }

    setBusy(true);
    try {
      // 与 App 一致：笔记/备忘无标题时用正文首行截取落库
      const resolvedTitle = resolveNoteTitleForSave({
        kind,
        title,
        body: storedBody,
        format: kStoredQuill,
      });
      const payload = {
        title: resolvedTitle,
        body: storedBody,
        format: kStoredQuill,
        kind,
        city,
        coverUrl: kind === "article" ? String(coverUrl || "").trim() : "",
        // 文章发布即可见（不再单独「上架」）
        listingStatus:
          kind === "article" || kind === "admonition" ? "listed" : "draft",
      };
      // 新备忘插到最前
      if (!editing && kind === "memo") {
        payload.sortOrder = -Date.now();
      }

      if (kind === "schedule") {
        const scheduleAt =
          fromDatetimeLocalValue(scheduleLocal) ||
          (initialScheduleAt ? new Date(initialScheduleAt) : new Date());
        payload.scheduleAt = scheduleAt.toISOString();
        payload.remindOffsetMin = remindOffsetMin;
        const freq = normalizeRecurFreq(recurFreq);
        payload.recurFreq = freq === kRecurOnce ? "" : freq;
        payload.recurByday =
          freq === kRecurWeekly
            ? recurByday || weekdayToByDay(scheduleAt)
            : null;
        if (freq !== kRecurOnce && recurEndMode === "until" && recurUntilLocal) {
          payload.recurUntil = new Date(
            `${recurUntilLocal}T23:59:00`,
          ).toISOString();
          payload.recurCount = null;
        } else if (freq !== kRecurOnce && recurEndMode === "count") {
          const c = parseInt(recurCount, 10);
          payload.recurCount = Number.isFinite(c) && c > 0 ? c : 10;
          payload.recurUntil = null;
        } else {
          payload.recurUntil = null;
          payload.recurCount = null;
        }
        const remind = remindAtFromOffset(scheduleAt, remindOffsetMin);
        payload.remindAt = remind ? remind.toISOString() : null;
      } else if (kind === "memo") {
        payload.scheduleAt = null;
        payload.remindAt = null;
        payload.noRemind = true;
        payload.recurFreq = "";
        payload.recurByday = null;
        payload.recurUntil = null;
        payload.recurCount = null;
        payload.remindOffsetMin = 0;
      } else {
        payload.scheduleAt = null;
        payload.remindAt = null;
        payload.recurFreq = "";
        payload.remindOffsetMin = 0;
      }

      const saved = editing
        ? await updateNote(note.id, payload)
        : await createNote(payload);
      const titleForBaseline =
        resolvedTitle || String(title || "").trim();
      if (resolvedTitle && resolvedTitle !== String(title || "").trim()) {
        setTitle(resolvedTitle);
      }
      toast?.(
        editing
          ? `已${kindActionLabel(kind)}`
          : kind === "note"
            ? "已保存"
            : `已${kindActionLabel(kind)}`,
      );
      // 用落库标题 + 当前正文采基线，避免 setTitle 异步导致「已保存仍脏」
      markClean({
        title: titleForBaseline,
        plain: String(plainNow() || "").trim(),
      });
      if (!skipNavigate) {
        if (editing) await onSaved?.(saved);
        else await onCreated?.(saved);
      }
      return saved;
    } catch (e) {
      toast?.(e.message || `${kindActionLabel(kind)}失败`);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  useImperativeHandle(ref, () => ({
    isDirty,
    getKind: () => kind,
    /** 离开页面前保存：不触发 onCreated/onSaved 导航，由外壳接手 */
    async save() {
      return handleSave({ skipNavigate: true });
    },
  }));

  const action = kindActionLabel(kind);

  return (
    <div className="note-editor-split">
      <div className="panel note-editor-main">
        {!lockedFromCal ? (
          <div className="field">
            <label>类型</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                ["note", "笔记"],
                ["memo", "备忘"],
                ["schedule", "日常"],
                ["article", "文章"],
                ...(isAdmin ? [["admonition", "谏言"]] : []),
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn ghost ${kind === id ? "on" : ""}`}
                  disabled={editorLocked}
                  onClick={() => {
                    if (editorLocked) return;
                    setKind(id);
                    if (id === "schedule" && !scheduleLocal) {
                      setScheduleLocal(toDatetimeLocalValue(new Date()));
                    }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="field-hint">{kindHint(kind)}</p>
          </div>
        ) : null}

        <div className="field">
          <label>标题</label>
          <input
            value={title}
            disabled={editorLocked}
            onChange={(e) => {
              setTitle(e.target.value);
              stopMicOnKeyboard();
            }}
            placeholder={
              kind === "article" || kind === "schedule" ? "必填" : "可选"
            }
          />
        </div>

        {kind === "article" ? (
          <div className="field article-cover-field">
            <label>封面</label>
            <div className="article-cover-picker">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaDisplayUrl(coverUrl)}
                  alt="封面"
                  className="article-cover-preview"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget.nextElementSibling;
                    if (fallback) fallback.hidden = false;
                  }}
                />
              ) : null}
              <div
                className="article-cover-empty"
                hidden={Boolean(coverUrl)}
              >
                未设置封面
              </div>
              <div className="article-cover-actions">
                <button
                  type="button"
                  className="btn ghost"
                  disabled={editorLocked}
                  onClick={pickCover}
                >
                  {coverUrl ? "更换封面" : "上传封面"}
                </button>
                {coverUrl ? (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={editorLocked}
                    onClick={() => setCoverUrl("")}
                  >
                    清除
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="field">
          <label>正文</label>
          <div className="quill-with-mic">
            <QuillEditorField
              ref={quillRef}
              body={bodySeed}
              format={bodyFormat}
              placeholder="写点什么…"
              readOnly={editorLocked}
              onChange={(ops) => {
                setBodyOps(ops);
                stopMicOnKeyboard();
              }}
            />
            {!editorLocked ? (
              <div className="quill-mic-fab">
                <VoiceMicButton
                  ref={micRef}
                  toast={toast}
                  onText={(t) => {
                    voiceInserting.current = true;
                    try {
                      quillRef.current?.insertText?.(t);
                    } finally {
                      queueMicrotask(() => {
                        voiceInserting.current = false;
                      });
                    }
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>

        {kind === "schedule" ? (
          <div
            className="schedule-opts"
            style={
              editorLocked
                ? { opacity: 0.55, pointerEvents: "none" }
                : undefined
            }
          >
            <div className="field">
              <label>日常时间</label>
              <input
                type="datetime-local"
                value={scheduleLocal}
                disabled={editorLocked}
                onChange={(e) => setScheduleLocal(e.target.value)}
              />
            </div>

            <div className="field">
              <label>重复</label>
              <div className="chip-row">
                {[
                  [kRecurOnce, "一次性"],
                  [kRecurDaily, "每天"],
                  [kRecurWeekly, "每周"],
                  [kRecurMonthly, "每月"],
                  [kRecurYearly, "每年"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`chip ${recurFreq === id ? "on" : ""}`}
                    onClick={() => {
                      setRecurFreq(id);
                      if (id === kRecurOnce) setRecurEndMode("never");
                      if (id === kRecurWeekly && scheduleLocal) {
                        const d = fromDatetimeLocalValue(scheduleLocal);
                        if (d) setRecurByday(weekdayToByDay(d));
                      }
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {recurFreq === kRecurWeekly ? (
              <div className="field">
                <label>每周几</label>
                <div className="chip-row">
                  {kRecurByDayCodes.map((code, i) => {
                    const labels = ["一", "二", "三", "四", "五", "六", "日"];
                    return (
                      <button
                        key={code}
                        type="button"
                        className={`chip ${recurByday === code ? "on" : ""}`}
                        onClick={() => setRecurByday(code)}
                      >
                        周{labels[i]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {isRecurringFreq(recurFreq) ? (
              <div className="field">
                <label>结束</label>
                <div className="chip-row" style={{ marginBottom: 8 }}>
                  {[
                    ["never", "永不"],
                    ["until", "结束日期"],
                    ["count", "重复次数"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`chip ${recurEndMode === id ? "on" : ""}`}
                      onClick={() => setRecurEndMode(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {recurEndMode === "until" ? (
                  <input
                    type="date"
                    value={recurUntilLocal}
                    onChange={(e) => setRecurUntilLocal(e.target.value)}
                  />
                ) : null}
                {recurEndMode === "count" ? (
                  <input
                    type="number"
                    min={1}
                    value={recurCount}
                    onChange={(e) => setRecurCount(e.target.value)}
                    placeholder="次数"
                    style={{ maxWidth: 120 }}
                  />
                ) : null}
              </div>
            ) : null}

            <div className="field">
              <label>提醒 · {formatRemindOffset(remindOffsetMin)}</label>
              <div className="chip-row">
                {REMIND_OFFSET_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`chip ${remindOffsetMin === p.value ? "on" : ""}`}
                    onClick={() => setRemindOffsetMin(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn"
            type="button"
            disabled={busy || aiBusy}
            onClick={() => handleSave().catch(() => {})}
          >
            {busy ? busyLabel(kind) : action}
          </button>
          {editing ? (
            <button
              className="btn ghost"
              type="button"
              disabled={busy || aiBusy}
              onClick={() => handleDelete()}
            >
              删除
            </button>
          ) : null}
        </div>
      </div>

      <aside className="note-editor-aside">
        <NoteAiPanel
          refKey={aiRefKey}
          expanded
          sideLayout
          getDraft={getDraft}
          applyTools={applyTools}
          toast={toast}
          onBusyChange={setAiBusy}
        />
      </aside>
    </div>
  );
});

export default NoteEditor;
