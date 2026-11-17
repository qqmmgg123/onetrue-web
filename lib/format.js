import { plainTextFromBody as plainFromQuill } from "./quill-body";

/** Quill Delta JSON 或纯文本 → 可读纯文本（与 App note_quill 对齐） */
export function plainTextFromBody(body, format) {
  return plainFromQuill(body, format);
}

/** 无标题时用正文首行生成标题（与 App `suggestNoteTitle` 对齐） */
export function suggestNoteTitle({
  title = "",
  body = "",
  fallback = "未命名",
  maxLen = 24,
  format,
} = {}) {
  const typed = String(title || "").trim();
  if (typed) return typed;

  const plain = plainTextFromBody(body, format);
  for (const line of plain.split(/\r?\n/)) {
    let s = line.trim();
    if (!s) continue;
    s = s.replace(/^([-*•]+|\d+[.\u3001、])\s*/, "").trim();
    if (!s) continue;
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}…`;
  }
  return fallback;
}

/**
 * 笔记/备忘：标题为空则用正文截取落库；日常/文章由 UI 强制必填。
 * 与 App `resolveNoteTitleForSave` 对齐。
 */
export function resolveNoteTitleForSave({
  kind = "note",
  title = "",
  body = "",
  format,
} = {}) {
  const typed = String(title || "").trim();
  if (typed) return typed;
  if (kind === "note" || kind === "memo") {
    return suggestNoteTitle({
      title: "",
      body,
      format,
      fallback: kind === "memo" ? "备忘" : "笔记",
      maxLen: 24,
    });
  }
  return "";
}

export function displayTitle(title, body, fallback = "无标题", format) {
  return suggestNoteTitle({
    title,
    body,
    fallback,
    maxLen: 36,
    format,
  });
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
