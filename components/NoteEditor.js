"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createNote, deleteNote, updateNote } from "../lib/api";
import { resolveNoteTitleForSave } from "../lib/format";
import { bodyToStorage, isBodyEmpty, kStoredQuill } from "../lib/quill-body";
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
  const editing = Boolean(note?.id);
  const defaultKind =
    note?.kind ||
    initialKind ||
    (initialScheduleAt ? "schedule" : "note");

  const [title, setTitle] = useState(note?.title || "");
  const [bodyOps, setBodyOps] = useState(null);
  const [bodySeed] = useState(note?.body || "");
  const [bodyFormat] = useState(note?.format || kStoredQuill);
  const [kind, setKind] = useState(defaultKind);
  const [city, setCity] = useState(note?.city || "");
  const [busy, setBusy] = useState(false);
  const quillRef = useRef(null);
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
    return (
      quillRef.current?.getPlain?.() ||
      (bodyOps
        ? bodyOps
            .map((o) => (typeof o.insert === "string" ? o.insert : ""))
            .join("")
            .replace(/\n+$/, "")
        : "")
    );
  }

  function snapshot() {
    return JSON.stringify({
      title: String(title || "").trim(),
      plain: String(plainNow() || "").trim(),
      kind,
      city: String(city || "").trim(),
      scheduleLocal,
      remindOffsetMin,
      recurFreq,
      recurByday,
      recurEndMode,
      recurUntilLocal,
      recurCount,
    });
  }

  function isDirty() {
    if (!baselineReady.current) return false;
    return snapshot() !== baselineRef.current;
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      baselineRef.current = snapshot();
      baselineReady.current = true;
    }, 400);
    return () => window.clearTimeout(t);
    // 仅挂载时采基线
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function optionsSnapshot() {
    return {
      kind,
      title,
      schedule_at: scheduleLocal
        ? fromDatetimeLocalValue(scheduleLocal)?.toISOString() || null
        : null,
      remind_at: null,
      recur_freq: recurFreq,
      recur_byday: recurByday,
      recur_until:
        recurEndMode === "until" && recurUntilLocal
          ? `${recurUntilLocal}T23:59:00`
          : null,
      recur_count:
        recurEndMode === "count" ? parseInt(recurCount, 10) || null : null,
      remind_offset_min: remindOffsetMin,
      listed: kind === "article",
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

  function applyTools(calls) {
    const tips = [];
    for (const call of calls || []) {
      const name = call.name;
      const args = call.args || {};
      switch (name) {
        case "set_title": {
          setTitle(String(args.title || "").trim());
          tips.push("已改标题");
          break;
        }
        case "replace_draft": {
          const plain = String(args.plain || "").trim();
          if (!plain) {
            tips.push("正文为空，未改动");
            break;
          }
          quillRef.current?.replacePlain?.(plain);
          tips.push("已写入正文");
          break;
        }
        case "replace_delta": {
          if (Array.isArray(args.delta)) {
            quillRef.current?.replaceDelta?.(args.delta);
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
          if (args.kind) {
            const k = String(args.kind).trim();
            if (["note", "memo", "schedule", "article"].includes(k)) {
              setKind(k);
            }
          }
          if (args.title != null) setTitle(String(args.title).trim());
          if (args.city != null) setCity(String(args.city).trim());
          if (args.schedule_at) {
            setScheduleLocal(toDatetimeLocalValue(args.schedule_at));
          }
          if (args.recur_freq != null) {
            setRecurFreq(normalizeRecurFreq(args.recur_freq));
          }
          if (args.recur_byday != null) {
            setRecurByday(String(args.recur_byday).toUpperCase());
          }
          if (args.recur_until) {
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
            setRemindOffsetMin(Number(args.remind_offset_min));
          }
          tips.push("已更新笔记选项");
          break;
        }
        default:
          tips.push(`未知工具：${name}`);
      }
    }
    return tips;
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
        // 文章发布即可见（不再单独「上架」）
        listingStatus: kind === "article" ? "listed" : "draft",
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
      baselineRef.current = snapshot();
      baselineReady.current = true;
      if (!skipNavigate) {
        if (editing) onSaved?.(saved);
        else onCreated?.(saved);
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
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn ghost ${kind === id ? "on" : ""}`}
                  onClick={() => {
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
            onChange={(e) => {
              setTitle(e.target.value);
              stopMicOnKeyboard();
            }}
            placeholder={
              kind === "article" || kind === "schedule" ? "必填" : "可选"
            }
          />
        </div>

        <div className="field">
          <label>正文</label>
          <div className="quill-with-mic">
            <QuillEditorField
              ref={quillRef}
              body={bodySeed}
              format={bodyFormat}
              placeholder="写点什么…"
              onChange={(ops) => {
                setBodyOps(ops);
                stopMicOnKeyboard();
              }}
            />
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
          </div>
        </div>

        {kind === "schedule" ? (
          <div className="schedule-opts">
            <div className="field">
              <label>日常时间</label>
              <input
                type="datetime-local"
                value={scheduleLocal}
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

        {kind === "article" ? (
          <div className="field">
            <label>城市（可选）</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="如：上海"
            />
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => handleSave().catch(() => {})}
          >
            {busy ? busyLabel(kind) : action}
          </button>
          {editing ? (
            <button
              className="btn ghost"
              type="button"
              disabled={busy}
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
        />
      </aside>
    </div>
  );
});

export default NoteEditor;
