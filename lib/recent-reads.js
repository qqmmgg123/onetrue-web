"use client";

/** 本机近期阅读（对齐 App article_reads），存 localStorage */

const KEY = "tihu.articleReads.v1";
const MAX = 100;

function safeParse(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch (_) {
    return [];
  }
}

function readAll() {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(KEY) || "[]");
}

function writeAll(list) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch (_) {}
}

export function listArticleReads({ limit = MAX } = {}) {
  return readAll()
    .slice()
    .sort(
      (a, b) =>
        new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime(),
    )
    .slice(0, limit);
}

export function latestArticleRead() {
  const list = listArticleReads({ limit: 1 });
  return list[0] || null;
}

/** @returns {object} 更新后的记录 */
export function upsertArticleRead(article) {
  if (!article?.id) return null;
  const now = new Date().toISOString();
  const next = {
    id: article.id,
    title: article.title || "",
    body: article.body || "",
    format: article.format || "quill",
    city: article.city || "",
    ownerId: article.ownerId || "",
    listedAt: article.listedAt || null,
    viewCount: article.viewCount ?? 0,
    recommendCount: article.recommendCount ?? 0,
    commentCount: article.commentCount ?? 0,
    lastReadAt: now,
  };
  const rest = readAll().filter((r) => r.id !== next.id);
  writeAll([next, ...rest]);
  return next;
}

export function readsToArticle(r) {
  if (!r) return null;
  return {
    id: r.id,
    title: r.title || "",
    body: r.body || "",
    format: r.format || "quill",
    city: r.city || "",
    ownerId: r.ownerId || "",
    listedAt: r.listedAt || r.lastReadAt,
    viewCount: r.viewCount ?? 0,
    recommendCount: r.recommendCount ?? 0,
    commentCount: r.commentCount ?? 0,
  };
}
