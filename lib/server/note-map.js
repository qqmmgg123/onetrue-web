/** notes 行 ↔ Web API 对象 */

export const NOTE_SELECT =
  "id,title,body,format,kind,listing_status,city,updated_at,created_at,listed_at,remind_at,schedule_at,owner_id,recur_freq,recur_interval,recur_byday,recur_until,recur_count,remind_offset_min";

export function mapNote(r) {
  if (!r) return null;
  return {
    id: r.id,
    title: r.title || "",
    body: r.body || "",
    format: r.format || "plain",
    kind: r.kind || "note",
    listingStatus: r.listing_status || "draft",
    city: r.city || "",
    updatedAt: r.updated_at,
    createdAt: r.created_at,
    listedAt: r.listed_at,
    remindAt: r.remind_at,
    scheduleAt: r.schedule_at,
    ownerId: r.owner_id,
    recurFreq: r.recur_freq || "",
    recurInterval: r.recur_interval ?? 1,
    recurByday: r.recur_byday || null,
    recurUntil: r.recur_until || null,
    recurCount: r.recur_count ?? null,
    remindOffsetMin:
      r.remind_offset_min == null ? 0 : Number(r.remind_offset_min),
  };
}

/** 从请求体解析重复/提醒字段（写入 DB 列名） */
export function recurFieldsFromBody(body, { kind } = {}) {
  const k = kind || body.kind || "note";
  if (k !== "schedule") {
    return {
      recur_freq: "",
      recur_interval: 1,
      recur_byday: null,
      recur_until: null,
      recur_count: null,
      remind_offset_min: 0,
    };
  }

  let freq = String(body.recurFreq ?? body.recur_freq ?? "")
    .trim()
    .toLowerCase();
  if (!["daily", "weekly", "monthly", "yearly"].includes(freq)) freq = "";

  const interval = Math.max(
    1,
    Number(body.recurInterval ?? body.recur_interval ?? 1) || 1,
  );
  let byday = body.recurByday ?? body.recur_byday ?? null;
  if (byday != null) {
    byday = String(byday).trim().toUpperCase() || null;
  }
  if (freq !== "weekly") byday = freq ? byday : null;

  let until = null;
  const untilRaw = body.recurUntil ?? body.recur_until;
  if (untilRaw) {
    const d = new Date(untilRaw);
    if (!Number.isNaN(d.getTime())) until = d.toISOString();
  }

  let count = body.recurCount ?? body.recur_count;
  if (count != null && count !== "") {
    count = parseInt(String(count), 10);
    if (!Number.isFinite(count) || count <= 0) count = null;
  } else {
    count = null;
  }
  // until / count 互斥：优先 until
  if (until) count = null;
  if (!freq) {
    until = null;
    count = null;
    byday = null;
  }

  let offset = body.remindOffsetMin ?? body.remind_offset_min;
  if (offset == null || offset === "") offset = 0;
  offset = parseInt(String(offset), 10);
  if (!Number.isFinite(offset)) offset = 0;
  // <0 = 不提醒

  return {
    recur_freq: freq,
    recur_interval: interval,
    recur_byday: byday,
    recur_until: until,
    recur_count: count,
    remind_offset_min: offset,
  };
}
