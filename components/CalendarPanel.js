"use client";

/**
 * 对齐 App `lib/ui/calendar_page.dart`：
 * - 右侧：宽屏周历 / 窄屏三日，时段 06–23
 * - 左侧侧栏：迷你月历 + 当天日常（Zoom 式布局）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAL_EVENT_GUTTER_PX,
  calendarTimeFromY,
  layoutCalendarEvents,
} from "../lib/calendar-layout";
import { displayTitle, formatWhen } from "../lib/format";
import { expandOccurrences } from "../lib/note-recur";

const HOUR_START = 6;
const HOUR_END = 23;
const ROW_H = 48;
const WD = ["一", "二", "三", "四", "五", "六", "日"];

export function dateOnly(d) {
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

/** 仅日程展开重复实例 */
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
    wasLong() {
      const v = armed.current;
      armed.current = false;
      return v;
    },
  };
}

function EventChip({ laid, onTapNote, onMoveNote }) {
  const { data, startMin, endMin, leftFrac, widthFrac } = laid;
  const { note, at } = data;
  const chipRef = useRef(null);
  const drag = useRef(null);
  const [offset, setOffset] = useState(null);
  const [dragging, setDragging] = useState(false);

  const top = (startMin / 60 - HOUR_START) * ROW_H;
  const height = Math.max(22, ((endMin - startMin) / 60) * ROW_H - 4);
  const gutter = CAL_EVENT_GUTTER_PX;

  const style = {
    top,
    height,
    left: `calc((100% - ${gutter}px) * ${leftFrac} + 2px)`,
    width: `calc((100% - ${gutter}px) * ${widthFrac} - 4px)`,
    right: "auto",
    ...(offset
      ? {
          transform: `translate(${offset.dx}px, ${offset.dy}px)`,
          zIndex: 20,
          opacity: 0.9,
          pointerEvents: "none",
        }
      : null),
  };

  function endDrag(e) {
    const s = drag.current;
    drag.current = null;
    setOffset(null);
    setDragging(false);
    if (!s?.moved) return;
    const cols = document.querySelectorAll(".cal-day-col[data-day]");
    let targetDay = null;
    let localY = 0;
    for (const col of cols) {
      const r = col.getBoundingClientRect();
      if (
        e.clientX >= r.left &&
        e.clientX < r.right &&
        e.clientY >= r.top &&
        e.clientY < r.bottom
      ) {
        const raw = col.getAttribute("data-day");
        targetDay = raw ? new Date(raw) : null;
        localY = e.clientY - r.top;
        break;
      }
    }
    if (!targetDay || Number.isNaN(targetDay.getTime())) return;
    const toAt = calendarTimeFromY({
      day: targetDay,
      localY,
      rowH: ROW_H,
      hourStart: HOUR_START,
      hourEnd: HOUR_END,
    });
    onMoveNote?.(note, at, toAt);
  }

  return (
    <button
      ref={chipRef}
      type="button"
      className={`cal-event-chip${dragging ? " dragging" : ""}`}
      style={style}
      title={displayTitle(note.title, note.body)}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = {
          x: e.clientX,
          y: e.clientY,
          moved: false,
        };
      }}
      onPointerMove={(e) => {
        const s = drag.current;
        if (!s) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (!s.moved && dx * dx + dy * dy < 36) return;
        if (!s.moved) {
          s.moved = true;
          setDragging(true);
        }
        setOffset({ dx, dy });
      }}
      onPointerUp={(e) => {
        const s = drag.current;
        if (!s) return;
        if (!s.moved) {
          drag.current = null;
          e.stopPropagation();
          onTapNote?.(note);
          return;
        }
        endDrag(e);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setOffset(null);
        setDragging(false);
      }}
      onClick={(e) => {
        // 点击由 pointerUp 处理，避免拖完再触发
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {displayTitle(note.title, note.body)}
    </button>
  );
}

function DayColumn({
  day,
  events,
  onTapSlot,
  onLongPressSlot,
  onTapNote,
  onMoveNote,
}) {
  const hours = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h);

  const visible = (events || []).filter(
    ({ at }) => at.getHours() >= HOUR_START && at.getHours() <= HOUR_END,
  );
  const laid = layoutCalendarEvents(visible, {
    startMinuteOf: (e) => e.at.getHours() * 60 + e.at.getMinutes(),
  });

  return (
    <div className="cal-day-col" data-day={day.toISOString()}>
      {hours.map((h) => (
        <HourCell
          key={h}
          day={day}
          hour={h}
          onTapSlot={onTapSlot}
          onLongPressSlot={onLongPressSlot}
        />
      ))}
      {laid.map((item) => (
        <EventChip
          key={`${item.data.note.id}-${item.data.at.getTime()}`}
          laid={item}
          onTapNote={onTapNote}
          onMoveNote={onMoveNote}
        />
      ))}
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
  onMoveNote,
}) {
  const hours = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h);
  const gridH = hours.length * ROW_H;

  return (
    <div className="cal-timeline" style={{ ["--cal-cols"]: days.length }}>
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
              onMoveNote={onMoveNote}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** 侧栏迷你月历 + 当天日常列表 */
export function CalendarSidebar({
  notes = [],
  selected,
  onSelect,
  onOpenNote,
  onCreateSchedule,
}) {
  const today = useMemo(() => dateOnly(new Date()), []);
  const selectedDay = selected ? dateOnly(selected) : today;
  const [month, setMonth] = useState(() => startOfMonth(selectedDay));

  useEffect(() => {
    setMonth(startOfMonth(selectedDay));
  }, [selectedDay]);

  const byDay = useMemo(() => {
    const from = addMonths(month, -1);
    const to = addMonths(month, 2);
    to.setHours(23, 59, 59, 999);
    return notesByDay(notes, from, to);
  }, [notes, month]);

  const monthCells = useMemo(() => {
    const first = startOfMonth(month);
    const pad = (first.getDay() + 6) % 7;
    const start = addDays(first, -pad);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const dayNotes = byDay[dateKey(selectedDay)] || [];

  function pickDay(d) {
    onSelect?.(dateOnly(d));
  }

  return (
    <div className="cal-side">
      <div className="cal-mini">
        <div className="cal-mini-head">
          <button
            type="button"
            className="cal-mini-nav"
            aria-label="上一年"
            onClick={() => setMonth(addMonths(month, -12))}
          >
            «
          </button>
          <button
            type="button"
            className="cal-mini-nav"
            aria-label="上一月"
            onClick={() => setMonth(addMonths(month, -1))}
          >
            ‹
          </button>
          <div className="cal-mini-title">
            {month.getFullYear()}年{month.getMonth() + 1}月
          </div>
          <button
            type="button"
            className="cal-mini-nav"
            aria-label="下一月"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            ›
          </button>
          <button
            type="button"
            className="cal-mini-nav"
            aria-label="下一年"
            onClick={() => setMonth(addMonths(month, 12))}
          >
            »
          </button>
        </div>
        <div className="cal-mini-wd">
          {WD.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="cal-mini-grid">
          {monthCells.map((d) => {
            const muted = d.getMonth() !== month.getMonth();
            const isSel = sameDay(d, selectedDay);
            const isToday = sameDay(d, today);
            const has = (byDay[dateKey(d)] || []).length > 0;
            return (
              <button
                key={dateKey(d)}
                type="button"
                className={[
                  "cal-mini-cell",
                  muted ? "muted" : "",
                  isToday ? "today" : "",
                  isSel ? "selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => pickDay(d)}
              >
                <span>{d.getDate()}</span>
                {has ? <i className="cal-mini-dot" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="cal-side-day">
        <div className="cal-side-day-head">
          <strong>
            {selectedDay.getMonth() + 1}月{selectedDay.getDate()}日 · 当天日常
          </strong>
          <button
            type="button"
            className="btn ghost cal-side-add-btn"
            onClick={() => onCreateSchedule?.(slotAt(selectedDay, 9))}
          >
            <span className="cal-side-add-plus" aria-hidden>
              ＋
            </span>
            安排
          </button>
        </div>
        <div className="cal-side-day-list">
          {dayNotes.length === 0 ? (
            <div className="side-hint">这一天暂无日常</div>
          ) : (
            dayNotes.map(({ note, at }) => (
              <div key={`${note.id}-${at.getTime()}`} className="hub-row">
                <button
                  type="button"
                  className="hub-row-main"
                  onClick={() => onOpenNote?.(note)}
                >
                  <div className="row-top">
                    <span className="label">
                      {displayTitle(note.title, note.body)}
                    </span>
                    <span className="action">{formatWhen(at)}</span>
                  </div>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function CalendarPanel({
  notes = [],
  selected: selectedProp,
  onSelect,
  onOpenNote,
  onCreateSchedule,
  onMoveNote,
}) {
  const today = useMemo(() => dateOnly(new Date()), []);
  const controlled = selectedProp != null && typeof onSelect === "function";
  const [innerSelected, setInnerSelected] = useState(() => today);
  const selected = controlled ? dateOnly(selectedProp) : innerSelected;

  const setSelected = useCallback(
    (d) => {
      const day = dateOnly(d);
      if (controlled) onSelect(day);
      else setInnerSelected(day);
    },
    [controlled, onSelect],
  );

  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(max-width: 860px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // 选中日变化时，宽屏周历定位到该周
  useEffect(() => {
    if (!narrow) setWeekStart(startOfWeek(selected));
  }, [selected, narrow]);

  const dayCount = narrow ? 3 : 7;
  const rangeStart = useMemo(() => {
    if (!narrow) return weekStart;
    return addDays(selected, -1);
  }, [narrow, weekStart, selected]);

  const byDay = useMemo(() => {
    const anchor = narrow ? selected : weekStart;
    const from = addMonths(startOfMonth(anchor), -2);
    const to = addMonths(startOfMonth(anchor), 4);
    to.setHours(23, 59, 59, 999);
    return notesByDay(notes, from, to);
  }, [notes, weekStart, selected, narrow]);

  const viewDays = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => addDays(rangeStart, i)),
    [dayCount, rangeStart],
  );

  const rangeEnd = addDays(rangeStart, dayCount - 1);
  const rangeLabel = `${rangeStart.getMonth() + 1}/${rangeStart.getDate()} – ${rangeEnd.getMonth() + 1}/${rangeEnd.getDate()}`;

  const onTapSlot = useCallback(
    (at) => {
      setSelected(dateOnly(at));
      onCreateSchedule?.(at);
    },
    [onCreateSchedule, setSelected],
  );
  const onLongPressSlot = useCallback(
    (at) => {
      setSelected(dateOnly(at));
      onCreateSchedule?.(at);
    },
    [onCreateSchedule, setSelected],
  );

  const handleMoveNote = useCallback(
    (note, fromAt, toAt) => {
      if (!note || !toAt) return;
      if (fromAt && toAt.getTime() === fromAt.getTime()) return;
      setSelected(dateOnly(toAt));
      onMoveNote?.(note, fromAt, toAt);
    },
    [onMoveNote, setSelected],
  );

  function shiftRange(dir) {
    const step = dayCount * dir;
    if (narrow) {
      setSelected(addDays(selected, step));
      return;
    }
    const next = addDays(weekStart, step);
    setWeekStart(next);
    setSelected(next);
  }

  return (
    <div className={`cal-root${narrow ? " cal-narrow" : ""}`}>
      <div className="cal-head">
        <button
          type="button"
          className="btn ghost"
          onClick={() => shiftRange(-1)}
        >
          {narrow ? "上一段" : "上周"}
        </button>
        <div style={{ textAlign: "center" }}>
          <strong>
            {rangeStart.getFullYear()} · {rangeLabel}
            {narrow ? " · 三日" : ""}
          </strong>
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={() => shiftRange(1)}
        >
          {narrow ? "下一段" : "下周"}
        </button>
      </div>

      <p className="cal-hint">
        {narrow
          ? "左右换三日；点空白叠卡；拖拽卡片改时间。"
          : "左右换周；点空白叠卡；拖拽卡片改时间。"}
      </p>

      <WeekTimeline
        days={viewDays}
        selected={selected}
        today={today}
        byDay={byDay}
        onSelectDay={setSelected}
        onTapSlot={onTapSlot}
        onLongPressSlot={onLongPressSlot}
        onTapNote={onOpenNote}
        onMoveNote={handleMoveNote}
      />
    </div>
  );
}
