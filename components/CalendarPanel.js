"use client";

import { useMemo, useState } from "react";
import { displayTitle, formatWhen } from "../lib/format";

function dateKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** 从笔记抽出日程/备忘落在哪一天 */
function notesByDay(notes) {
  const map = {};
  for (const n of notes || []) {
    const raw = n.scheduleAt || n.remindAt;
    if (!raw) continue;
    const at = new Date(raw);
    if (Number.isNaN(at.getTime())) continue;
    const k = dateKey(at);
    if (!map[k]) map[k] = [];
    map[k].push({ note: n, at });
  }
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => a.at - b.at);
  }
  return map;
}

export default function CalendarPanel({
  notes = [],
  onOpenNote,
  onCreateSchedule,
}) {
  const today = new Date();
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selected, setSelected] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  const byDay = useMemo(() => notesByDay(notes), [notes]);

  const cells = useMemo(() => {
    const first = startOfMonth(month);
    const startPad = (first.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0,
    ).getDate();
    const list = [];
    for (let i = 0; i < startPad; i++) {
      const d = new Date(first);
      d.setDate(d.getDate() - (startPad - i));
      list.push({ date: d, muted: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({
        date: new Date(month.getFullYear(), month.getMonth(), d),
        muted: false,
      });
    }
    while (list.length % 7 !== 0) {
      const last = list[list.length - 1].date;
      const n = new Date(last);
      n.setDate(n.getDate() + 1);
      list.push({ date: n, muted: true });
    }
    return list;
  }, [month]);

  const selectedKey = dateKey(selected);
  const dayNotes = byDay[selectedKey] || [];

  return (
    <div>
      <div className="cal-head">
        <button
          type="button"
          className="btn ghost"
          onClick={() => setMonth((m) => addMonths(m, -1))}
        >
          上月
        </button>
        <strong>
          {month.getFullYear()}年{month.getMonth() + 1}月
        </strong>
        <button
          type="button"
          className="btn ghost"
          onClick={() => setMonth((m) => addMonths(m, 1))}
        >
          下月
        </button>
      </div>
      <div className="cal-grid" style={{ marginBottom: 0 }}>
        {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
          <div
            key={w}
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "#888",
              padding: "4px 0",
            }}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map(({ date, muted }) => {
          const k = dateKey(date);
          const isToday = k === dateKey(today);
          const isSel = k === selectedKey;
          const has = Boolean(byDay[k]?.length);
          return (
            <button
              key={k + (muted ? "m" : "")}
              type="button"
              className={`cal-cell ${muted ? "muted" : ""} ${isToday ? "today" : ""} ${isSel ? "selected" : ""}`}
              onClick={() => setSelected(date)}
            >
              {date.getDate()}
              {has ? <span className="dot" /> : null}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "8px 16px 24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <strong>
            {selected.getMonth() + 1}月{selected.getDate()}日
          </strong>
          <button
            type="button"
            className="btn ghost"
            onClick={() => onCreateSchedule?.(selected)}
          >
            新建日程
          </button>
        </div>
        {dayNotes.length === 0 ? (
          <div className="empty" style={{ padding: "16px 0" }}>
            这一天暂无备忘或日程
          </div>
        ) : (
          dayNotes.map(({ note, at }) => (
            <button
              key={note.id}
              type="button"
              className="list-item"
              style={{ gridTemplateColumns: "1fr auto" }}
              onClick={() => onOpenNote?.(note)}
            >
              <div>
                <div className="title">{displayTitle(note.title, note.body)}</div>
                <div className="meta">
                  {note.kind === "schedule" ? "日程" : "备忘"} · {formatWhen(at)}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
