"use client";

import { useMemo, useRef, useState } from "react";
import { createNote, updateNote } from "../lib/api";
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

export default function NoteEditor({
  note = null,
  onCreated,
  onSaved,
  onCancel,
  toast,
  initialScheduleAt = null,
  initialRemindAt = null,
  initialKind = null,
}) {
  const editing = Boolean(note?.id);
  const defaultKind =
    note?.kind ||
    initialKind ||
    (initialScheduleAt ? "schedule" : initialRemindAt ? "memo" : "note");

  const [title, setTitle] = useState(note?.title || "");
  const [bodyOps, setBodyOps] = useState(null);
  const [bodySeed] = useState(note?.body || "");
  const [bodyFormat] = useState(note?.format || kStoredQuill);
  const [kind, setKind] = useState(defaultKind);
  const [listIt, setListIt] = useState(
    note?.listingStatus === "listed" || note?.kind === "article",
  );
  const [city, setCity] = useState(note?.city || "");
  const [busy, setBusy] = useState(false);
  const quillRef = useRef(null);
  const aiRefKey = note?.id || `draft:${defaultKind}`;

  const [scheduleLocal, setScheduleLocal] = useState(() =>
    toDatetimeLocalValue(
      note?.scheduleAt || initialScheduleAt || (defaultKind === "schedule" ? new Date() : null),
    ),
  );
  const [memoRemindLocal, setMemoRemindLocal] = useState(() =>
    toDatetimeLocalValue(
      note?.remindAt || initialRemindAt || (defaultKind === "memo" ? new Date() : null),
    ),
  );
  const [memoNoRemind, setMemoNoRemind] = useState(
    defaultKind === "memo" && editing && !note?.remindAt,
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

  const lockedFromCal =
    !editing && Boolean(initialScheduleAt || initialRemindAt);
  const heading = editing
    ? kind === "schedule"
      ? "编辑日程"
      : kind === "memo"
        ? "编辑备忘"
        : kind === "article"
          ? "编辑文章"
          : "编辑笔记"
    : defaultKind === "schedule"
      ? "新建日程"
      : defaultKind === "memo"
        ? "新建备忘"
        : "写笔记";

  const whenHint = useMemo(() => {
    if (kind === "schedule" && scheduleLocal) {
      const d = fromDatetimeLocalValue(scheduleLocal);
      return d ? `日程时间：${d.toLocaleString()}` : "";
    }
    if (kind === "memo" && !memoNoRemind && memoRemindLocal) {
      const d = fromDatetimeLocalValue(memoRemindLocal);
      return d ? `备忘提醒：${d.toLocaleString()}` : "";
    }
    if (kind === "memo" && memoNoRemind) return "备忘 · 不提醒";
    return "";
  }, [kind, scheduleLocal, memoRemindLocal, memoNoRemind]);

  function optionsSnapshot() {
    return {
      kind,
      title,
      schedule_at: scheduleLocal
        ? fromDatetimeLocalValue(scheduleLocal)?.toISOString() || null
        : null,
      remind_at: memoNoRemind
        ? ""
        : memoRemindLocal
          ? fromDatetimeLocalValue(memoRemindLocal)?.toISOString() || null
          : null,
      recur_freq: recurFreq,
      recur_byday: recurByday,
      recur_until:
        recurEndMode === "until" && recurUntilLocal
          ? `${recurUntilLocal}T23:59:00`
          : null,
      recur_count:
        recurEndMode === "count" ? parseInt(recurCount, 10) || null : null,
      remind_offset_min: remindOffsetMin,
      listed: listIt,
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
              if (k === "article") setListIt(true);
            }
          }
          if (args.title != null) setTitle(String(args.title).trim());
          if (args.city != null) setCity(String(args.city).trim());
          if (args.listed != null) setListIt(Boolean(args.listed));
          if (args.schedule_at) {
            setScheduleLocal(toDatetimeLocalValue(args.schedule_at));
          }
          if (args.remind_at !== undefined) {
            const raw = String(args.remind_at || "").trim();
            if (!raw) setMemoNoRemind(true);
            else {
              setMemoNoRemind(false);
              setMemoRemindLocal(toDatetimeLocalValue(raw));
            }
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

  async function handleSave() {
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
      toast?.("请填写标题或正文");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        title,
        body: storedBody,
        format: kStoredQuill,
        kind,
        city,
        listingStatus: kind === "article" && listIt ? "listed" : "draft",
      };

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
        payload.recurFreq = "";
        payload.recurByday = null;
        payload.recurUntil = null;
        payload.recurCount = null;
        payload.remindOffsetMin = 0;
        if (memoNoRemind) {
          payload.remindAt = null;
          payload.noRemind = true;
        } else {
          const remindAt =
            fromDatetimeLocalValue(memoRemindLocal) ||
            (initialRemindAt ? new Date(initialRemindAt) : new Date());
          payload.remindAt = remindAt.toISOString();
        }
      } else {
        payload.scheduleAt = null;
        payload.remindAt = null;
        payload.recurFreq = "";
        payload.remindOffsetMin = 0;
      }

      const saved = editing
        ? await updateNote(note.id, payload)
        : await createNote(payload);
      toast?.(
        saved?.listingStatus === "listed"
          ? editing
            ? "已更新并上架"
            : "已上架雅集"
          : editing
            ? "已更新"
            : "已保存",
      );
      if (editing) onSaved?.(saved);
      else onCreated?.(saved);
    } catch (e) {
      toast?.(e.message || "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="note-editor-split">
    <div className="panel note-editor-main">
      <h2>{heading}</h2>
      <p className="hint">
        正文与 App 共用 Quill Delta；上架文章会出现在求索雅集。
        {whenHint ? ` ${whenHint}` : ""}
      </p>

      {!lockedFromCal ? (
        <div className="field">
          <label>类型</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              ["note", "随笔"],
              ["memo", "备忘"],
              ["schedule", "日程"],
              ["article", "文章"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`btn ghost ${kind === id ? "on" : ""}`}
                onClick={() => {
                  setKind(id);
                  if (id === "article") setListIt(true);
                  if (id === "schedule" && !scheduleLocal) {
                    setScheduleLocal(toDatetimeLocalValue(new Date()));
                  }
                  if (id === "memo" && !memoRemindLocal) {
                    setMemoRemindLocal(toDatetimeLocalValue(new Date()));
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="field">
        <label>标题</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === "article" ? "文章标题" : "可选"}
        />
      </div>

      <div className="field">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <label style={{ margin: 0 }}>正文</label>
          <VoiceMicButton
            mode="dictation"
            toast={toast}
            onText={(t) => quillRef.current?.insertText?.(t)}
          />
        </div>
        <QuillEditorField
          ref={quillRef}
          body={bodySeed}
          format={bodyFormat}
          placeholder="写点什么…"
          onChange={(ops) => setBodyOps(ops)}
        />
      </div>

      {kind === "schedule" ? (
        <div className="schedule-opts">
          <div className="field">
            <label>日程时间</label>
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

      {kind === "memo" ? (
        <div className="schedule-opts">
          <div className="field">
            <label>提醒时间</label>
            <div className="chip-row" style={{ marginBottom: 8 }}>
              <button
                type="button"
                className={`chip ${!memoNoRemind ? "on" : ""}`}
                onClick={() => setMemoNoRemind(false)}
              >
                提醒
              </button>
              <button
                type="button"
                className={`chip ${memoNoRemind ? "on" : ""}`}
                onClick={() => setMemoNoRemind(true)}
              >
                不提醒
              </button>
            </div>
            {!memoNoRemind ? (
              <input
                type="datetime-local"
                value={memoRemindLocal}
                onChange={(e) => setMemoRemindLocal(e.target.value)}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {kind === "article" ? (
        <>
          <div className="field">
            <label>城市（可选）</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="如：上海"
            />
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={listIt}
              onChange={(e) => setListIt(e.target.checked)}
            />
            上架到雅集
          </label>
        </>
      ) : null}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn"
          type="button"
          disabled={busy}
          onClick={handleSave}
        >
          {busy ? "保存中…" : editing ? "更新" : "保存"}
        </button>
        {onCancel ? (
          <button className="btn ghost" type="button" onClick={onCancel}>
            取消
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
}
