/** 与 App lib/domain/note_recur.dart 对齐（Web 日程重复 / 提醒） */

export const kRecurOnce = "once";
export const kRecurDaily = "daily";
export const kRecurWeekly = "weekly";
export const kRecurMonthly = "monthly";
export const kRecurYearly = "yearly";
export const kRecurByDayCodes = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

export function weekdayToByDay(dt) {
  const d = dt instanceof Date ? dt : new Date(dt);
  return kRecurByDayCodes[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

export function byDayToWeekday(code) {
  const i = kRecurByDayCodes.indexOf(String(code || "").toUpperCase());
  return i < 0 ? null : i + 1; // 1=Mon … 7=Sun
}

export function normalizeRecurFreq(raw) {
  const f = String(raw || "")
    .trim()
    .toLowerCase();
  switch (f) {
    case kRecurDaily:
    case kRecurWeekly:
    case kRecurMonthly:
    case kRecurYearly:
      return f;
    default:
      return kRecurOnce;
  }
}

export function isRecurringFreq(freq) {
  return normalizeRecurFreq(freq) !== kRecurOnce;
}

/** offsetMin < 0 → 不提醒 */
export function remindAtFromOffset(scheduleAt, offsetMin) {
  if (!scheduleAt || offsetMin == null || offsetMin < 0) return null;
  const d = scheduleAt instanceof Date ? scheduleAt : new Date(scheduleAt);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - offsetMin * 60 * 1000);
}

export function offsetMinFromRemind(scheduleAt, remindAt) {
  if (!scheduleAt || !remindAt) return 0;
  const s = scheduleAt instanceof Date ? scheduleAt : new Date(scheduleAt);
  const r = remindAt instanceof Date ? remindAt : new Date(remindAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(r.getTime())) return 0;
  const diff = Math.round((s.getTime() - r.getTime()) / 60000);
  return diff < 0 ? 0 : diff;
}

export function formatRemindOffset(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m < 0) return "不提醒";
  if (m <= 0) return "日程开始时";
  if (m % (24 * 60) === 0) return `提前 ${m / (24 * 60)} 天`;
  if (m % 60 === 0) return `提前 ${m / 60} 小时`;
  return `提前 ${m} 分钟`;
}

export const REMIND_OFFSET_PRESETS = [
  { label: "不提醒", value: -1 },
  { label: "日程开始时", value: 0 },
  { label: "提前 5 分钟", value: 5 },
  { label: "提前 10 分钟", value: 10 },
  { label: "提前 15 分钟", value: 15 },
  { label: "提前 30 分钟", value: 30 },
  { label: "提前 1 小时", value: 60 },
  { label: "提前 1 天", value: 24 * 60 },
];

function dateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function withTime(day, template) {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    template.getHours(),
    template.getMinutes(),
    template.getSeconds(),
    template.getMilliseconds(),
  );
}

function addMonthsClamped(base, months) {
  const y = base.getFullYear();
  const m0 = base.getMonth() + months;
  const y2 = y + Math.floor(m0 / 12);
  const m2 = ((m0 % 12) + 12) % 12;
  const last = new Date(y2, m2 + 1, 0).getDate();
  const day = Math.min(base.getDate(), last);
  return new Date(
    y2,
    m2,
    day,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds(),
  );
}

/** 展开日程实例（本地时区），窗口 [from, to] */
export function expandOccurrences(note, { from, to, safetyCap = 400 } = {}) {
  if (!note?.scheduleAt || note.kind !== "schedule") return [];
  const start = new Date(note.scheduleAt);
  if (Number.isNaN(start.getTime())) return [];
  const windowFrom = from instanceof Date ? from : new Date(from);
  const windowTo = to instanceof Date ? to : new Date(to);
  if (Number.isNaN(windowFrom.getTime()) || Number.isNaN(windowTo.getTime())) {
    return [];
  }

  const freq = normalizeRecurFreq(note.recurFreq);
  if (freq === kRecurOnce) {
    if (start >= windowFrom && start <= windowTo) return [start];
    return [];
  }

  const interval = Math.max(1, Number(note.recurInterval) || 1);
  let untilEnd = null;
  if (note.recurUntil) {
    const u = new Date(note.recurUntil);
    if (!Number.isNaN(u.getTime())) {
      untilEnd = new Date(
        u.getFullYear(),
        u.getMonth(),
        u.getDate(),
        23,
        59,
        59,
        999,
      );
    }
  }
  const count =
    note.recurCount != null && Number(note.recurCount) > 0
      ? Number(note.recurCount)
      : null;

  let cursor;
  switch (freq) {
    case kRecurWeekly: {
      const want = byDayToWeekday(note.recurByday) || start.getDay() || 7;
      // JS: Sun=0 … want is Mon=1..Sun=7
      let d = dateOnly(start);
      const jsWant = want === 7 ? 0 : want;
      while (d.getDay() !== jsWant) {
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      }
      cursor = withTime(d, start);
      break;
    }
    default:
      cursor = start;
  }

  const out = [];
  let seriesIndex = 0;
  let guard = 0;
  while (cursor && guard < safetyCap * 8) {
    guard += 1;
    if (untilEnd && cursor > untilEnd) break;
    if (count != null && seriesIndex >= count) break;
    if (cursor > windowTo) break;

    if (cursor >= windowFrom && cursor <= windowTo) {
      out.push(new Date(cursor));
      if (out.length >= safetyCap) break;
    }
    seriesIndex += 1;

    switch (freq) {
      case kRecurDaily:
        cursor = new Date(cursor.getTime() + interval * 86400000);
        break;
      case kRecurWeekly:
        cursor = new Date(cursor.getTime() + 7 * interval * 86400000);
        break;
      case kRecurMonthly:
        cursor = addMonthsClamped(cursor, interval);
        break;
      case kRecurYearly:
        cursor = addMonthsClamped(cursor, 12 * interval);
        break;
      default:
        cursor = null;
    }
  }
  return out;
}

export function formatRecurSummary({
  freq,
  byday,
  until,
  count,
  scheduleAt,
} = {}) {
  const f = normalizeRecurFreq(freq);
  if (f === kRecurOnce) return "一次性";
  let base;
  switch (f) {
    case kRecurDaily:
      base = "每天";
      break;
    case kRecurWeekly: {
      const wd =
        byDayToWeekday(byday) ||
        (scheduleAt ? new Date(scheduleAt).getDay() || 7 : 1);
      const labels = ["一", "二", "三", "四", "五", "六", "日"];
      const idx = wd === 7 ? 6 : wd - 1;
      base = `每周${labels[idx]}`;
      break;
    }
    case kRecurMonthly: {
      const day = scheduleAt ? new Date(scheduleAt).getDate() : 1;
      base = `每月${day}日`;
      break;
    }
    case kRecurYearly: {
      if (scheduleAt) {
        const d = new Date(scheduleAt);
        base = `每年${d.getMonth() + 1}月${d.getDate()}日`;
      } else base = "每年";
      break;
    }
    default:
      base = "一次性";
  }
  if (count != null && count > 0) return `${base} · ${count}次`;
  if (until) {
    const u = new Date(until);
    if (!Number.isNaN(u.getTime())) {
      const mm = String(u.getMonth() + 1).padStart(2, "0");
      const dd = String(u.getDate()).padStart(2, "0");
      return `${base} · 至${u.getFullYear()}-${mm}-${dd}`;
    }
  }
  return `${base} · 永不结束`;
}

/** datetime-local value ↔ ISO */
export function toDatetimeLocalValue(isoOrDate) {
  if (!isoOrDate) return "";
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
