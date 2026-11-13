import { plainTextFromBody as plainFromQuill } from "./quill-body";

/** Quill Delta JSON 或纯文本 → 可读纯文本（与 App note_quill 对齐） */
export function plainTextFromBody(body, format) {
  return plainFromQuill(body, format);
}

export function displayTitle(title, body, fallback = "无标题", format) {
  const t = String(title || "").trim();
  if (t) return t;
  const plain = plainTextFromBody(body, format);
  for (const line of plain.split(/\r?\n/)) {
    let s = line.trim();
    if (!s) continue;
    s = s.replace(/^([-*•]+|\d+[.\u3001、])\s*/, "").trim();
    if (!s) continue;
    return s.length <= 36 ? s : `${s.slice(0, 36)}…`;
  }
  return fallback;
}

export function snippet(title, body, max = 72) {
  const plain = plainTextFromBody(body).replace(/\s+/g, " ").trim();
  const t = displayTitle(title, body);
  if (!plain || plain === t) return t;
  const rest = plain.length > max ? `${plain.slice(0, max)}…` : plain;
  return `${t} · ${rest}`;
}

export function excerpt(body, max = 96) {
  const plain = plainTextFromBody(body).replace(/\s+/g, " ").trim();
  if (!plain) return "";
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}

export function formatWhen(iso) {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
  if (sameDay) return hm;
  if (isYday) return `昨天 ${hm}`;
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
  }
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function hotScore(article) {
  const listedAt = article.listedAt ? new Date(article.listedAt) : null;
  const ageHours = listedAt
    ? Math.min(
        24 * 90,
        Math.max(0, (Date.now() - listedAt.getTime()) / 3600000),
      )
    : 24 * 30;
  const recency = Math.max(0, Math.min(24 * 14, 24 * 14 - ageHours)) / (24 * 14);
  return (
    (article.recommendCount || 0) * 5 +
    (article.commentCount || 0) * 3 +
    (article.viewCount || 0) +
    recency * 10
  );
}

/** 简易把正文渲染成段落（纯文本 / 抽取后的 Quill 文本）；富文本展示请用 QuillBodyView */
export function bodyToParagraphs(body, format) {
  const plain = plainTextFromBody(body, format);
  if (!plain) return [];
  return plain.split(/\n+/).map((p) => p.trim()).filter(Boolean);
}
