"use client";

/**
 * 对齐 App `lib/ui/calendar_page.dart` 三日历：
 * - 时段网格 06–23，每行一小时
 * - 点空白 → 该时刻新建日程；长按/右键 → 新建备忘
 * - 事件按 hour+minute 绝对定位，固定约 1 小时高
 * Web 用周历（7 列）；月历入口已隐藏。
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { displayTitle, formatWhen } from "../lib/format";
import { expandOccurrences } from "../lib/note-recur";

const HOUR_START = 6;
const HOUR_END = 23;
const ROW_H = 48;
const WD = ["一", "二", "三", "四", "五", "六", "日"];

function dateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dateKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function sameDay(a, b) {
  return dateKey(a) === dateKey(b);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function startOfWeek(d) {
  const x = dateOnly(d);
  const pad = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - pad);
  return x;
}

function addDays(d, n) {
  const x = dateOnly(d);
  x.setDate(x.getDate() + n);
  return x;
}

function slotAt(day, hour) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0);
}

/** 仅日程展开重复实例（日常页不再展示备忘） */
function notesByDay(notes, from, to) {
  const map = {};
  const windowFrom =
    from || new Date(new Date().getFullYear() - 1, 0, 1);
  const windowTo = to || new Date(new Date().getFullYear() + 2, 11, 31);
  for (const n of notes || []) {
    if (n.kind === "schedule" && n.scheduleAt) {
      const occ = expandOccurrences(n, { from: windowFrom, to: windowTo });
      for (const at of occ) {
        const k = dateKey(at);
        if (!map[k]) map[k] = [];
        map[k].push({ note: n, at });
      }
    }
  }
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => a.at - b.at);
  }
  return map;
}

function useLongPress(onLong, ms = 450) {
  const timer = useRef(null);
  const armed = useRef(false);
  const clear = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return {
    onPointerDown(e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      armed.current = false;
      clear();
      timer.current = window.setTimeout(() => {
        armed.current = true;
        onLong?.();
      }, ms);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    /** 若已触发长按，吞掉随后的 click */
    wasLong() {
      const v = armed.current;
      armed.current = false;
      return v;
    },
  };
}

function DayColumn({
  day,
  events,
  onTapSlot,
  onLongPressSlot,
  onTapNote,
}) {
  const hours = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h);

  return (
    <div className="cal-day-col">
      {hours.map((h) => (
        <HourCell
          key={h}
          day={day}
          hour={h}
          onTapSlot={onTapSlot}
          onLongPressSlot={onLongPressSlot}
        />
      ))}
      {events.map(({ note, at }) => {
        if (at.getHours() < HOUR_START || at.getHours() > HOUR_END) return null;
        const top =
          (at.getHours() - HOUR_START) * ROW_H +
          (at.getMinutes() / 60) * ROW_H;
        return (
          <button
            key={`${note.id}-${at.getTime()}`}
            type="button"
            className="cal-event-chip"
            style={{ top, height: ROW_H - 4 }}
            title={displayTitle(note.title, note.body)}
            onClick={(e) => {
              e.stopPropagation();
              onTapNote?.(note);
            }}
          >
            {displayTitle(note.title, note.body)}
          </button>
        );
      })}
    </div>
  );
}

function HourCell({ day, hour, onTapSlot, onLongPressSlot }) {
  const lp = useLongPress(() => onLongPressSlot?.(slotAt(day, hour)));
  return (
    <div
      className="cal-hour-cell"
      style={{ height: ROW_H }}
      {...lp}
      onClick={() => {
        if (lp.wasLong()) return;
        onTapSlot?.(slotAt(day, hour));
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPressSlot?.(slotAt(day, hour));
      }}
    />
  );
}

function WeekTimeline({
  days,
  selected,
  today,
  byDay,
  onSelectDay,
  onTapSlot,
  onLongPressSlot,
  onTapNote,
}) {
  const hours = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h);
  const gridH = hours.length * ROW_H;

  return (
    <div className="cal-timeline">
      <div className="cal-timeline-head">
        <div className="cal-gutter" />
        {days.map((d) => {
          const sel = sameDay(d, selected);
          const isToday = sameDay(d, today);
          return (
            <button
              key={dateKey(d)}
              type="button"
              className={`cal-day-head ${sel ? "selected" : ""} ${isToday ? "today" : ""}`}
              onClick={() => onSelectDay(d)}
            >
              <span>{WD[(d.getDay() + 6) % 7]}</span>
              <strong>{d.getDate()}</strong>
            </button>
          );
        })}
      </div>
      <div className="cal-timeline-scroll">
        <div className="cal-timeline-body" style={{ height: gridH }}>
          <div className="cal-gutter cal-gutter-hours">
            {hours.map((h) => (
              <div key={h} className="cal-hour-label" style={{ height: ROW_H }}>
                {String(h).padStart(2, "0")}
              </div>
            ))}
          </div>
          {days.map((d) => (
            <DayColumn
              key={dateKey(d)}
              day={d}
              events={byDay[dateKey(d)] || []}
              onTapSlot={onTapSlot}
              onLongPressSlot={onLongPressSlot}
              onTapNote={onTapNote}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CalendarPanel({
  notes = [],
  onOpenNote,
  onCreateSchedule,
}) {
  const today = useMemo(() => dateOnly(new Date()), []);
  // 月历尚未完善：固定周历
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [selected, setSelected] = useState(() => today);

  const byDay = useMemo(() => {
    const from = addMonths(startOfMonth(weekStart), -2);
    const to = addMonths(startOfMonth(weekStart), 4);
    to.setHours(23, 59, 59, 999);
    return notesByDay(notes, from, to);
  }, [notes, weekStart]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const selectedKey = dateKey(selected);
  const dayNotes = byDay[selectedKey] || [];
  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()} – ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;

  const onTapSlot = useCallback(
    (at) => {
      setSelected(dateOnly(at));
      onCreateSchedule?.(at);
    },
    [onCreateSchedule],
  );
  const onLongPressSlot = useCallback(
    (at) => {
      setSelected(dateOnly(at));
      onCreateSchedule?.(at);
    },
    [onCreateSchedule],
  );

  return (
    <div className="cal-root">
      <div className="cal-head">
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            const next = addDays(weekStart, -7);
            setWeekStart(next);
            setSelected(next);
          }}
        >
          上周
        </button>
        <div style={{ textAlign: "center" }}>
          <strong>
            {weekStart.getFullYear()} · {weekLabel}
          </strong>
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            const next = addDays(weekStart, 7);
            setWeekStart(next);
            setSelected(next);
          }}
        >
          下周
        </button>
      </div>

      <p className="cal-hint">左右换周；点空白时段安排日常。</p>

      <WeekTimeline
        days={weekDays}
        selected={selected}
        today={today}
        byDay={byDay}
        onSelectDay={setSelected}
        onTapSlot={onTapSlot}
        onLongPressSlot={onLongPressSlot}
        onTapNote={onOpenNote}
      />

      <div style={{ padding: "8px 16px 24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <strong>
            {selected.getMonth() + 1}月{selected.getDate()}日 · 当天日常
          </strong>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn ghost"
              onClick={() => onCreateSchedule?.(slotAt(selected, 9))}
            >
              安排日常
            </button>
          </div>
        </div>
        {dayNotes.length === 0 ? (
          <div className="empty" style={{ padding: "16px 0" }}>
            这一天暂无日常
          </div>
        ) : (
          dayNotes.map(({ note, at }) => (
            <button
              key={`${note.id}-${at.getTime()}`}
              type="button"
              className="list-item"
              style={{ gridTemplateColumns: "1fr auto" }}
              onClick={() => onOpenNote?.(note)}
            >
              <div>
                <div className="title">{displayTitle(note.title, note.body)}</div>
                <div className="meta">日常 · {formatWhen(at)}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
