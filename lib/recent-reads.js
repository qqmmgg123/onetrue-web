"use client";

/**
 * 近期阅读：仅登录用户
 * - 本机 localStorage user:{id} 缓存 + /api/reads 云端
 * - 游客不写入、不展示
 */

const LEGACY_KEY = "tihu.articleReads.v1";
const GUEST_KEY = "tihu.articleReads.guest.v1";
const MAX = 100;

function userKey(userId) {
  return `tihu.articleReads.user.${userId}.v1`;
}

function safeParse(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch (_) {
    return [];
  }
}

function readKey(key) {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(key) || "[]");
}

function writeKey(key, list) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list.slice(0, MAX)));
  } catch (_) {}
}

/** 旧版单 key 迁到游客桶（只迁一次） */
function migrateLegacyToGuest() {
  if (typeof window === "undefined") return;
  try {
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    const guest = window.localStorage.getItem(GUEST_KEY);
    if (!guest) {
      window.localStorage.setItem(GUEST_KEY, legacy);
    }
    window.localStorage.removeItem(LEGACY_KEY);
  } catch (_) {}
}

function storageKey(userId) {
  migrateLegacyToGuest();
  const uid = String(userId || "").trim();
  return uid ? userKey(uid) : GUEST_KEY;
}

function sortLimit(list, limit = MAX) {
  return list
    .slice()
    .sort(
      (a, b) =>
        new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime(),
    )
    .slice(0, limit);
}

/** @param {string} [userId] 登录用户 id；空=游客 */
export function listArticleReads({ userId = "", limit = MAX } = {}) {
  return sortLimit(readKey(storageKey(userId)), limit);
}

export function latestArticleRead(userId = "") {
  const list = listArticleReads({ userId, limit: 1 });
  return list[0] || null;
}

/**
 * 本机 upsert（游客或登录缓存）。
 * @returns {object|null}
 */
export function upsertArticleReadLocal(article, userId = "") {
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
  const key = storageKey(userId);
  const rest = readKey(key).filter((r) => r.id !== next.id);
  writeKey(key, [next, ...rest]);
  return next;
}

/** 用云端列表覆盖登录用户本机缓存（不碰游客桶） */
export function replaceUserArticleReadsCache(userId, items) {
  const uid = String(userId || "").trim();
  if (!uid) return;
  const list = (items || []).map((r) => ({
    id: r.id || r.noteId,
    title: r.title || "",
    body: r.body || "",
    format: r.format || "quill",
    city: r.city || "",
    ownerId: r.ownerId || "",
    listedAt: r.listedAt || null,
    viewCount: r.viewCount ?? 0,
    recommendCount: r.recommendCount ?? 0,
    commentCount: r.commentCount ?? 0,
    lastReadAt: r.lastReadAt || new Date().toISOString(),
  }));
  writeKey(userKey(uid), sortLimit(list));
}

/** @deprecated 仅登录写入；无 userId 时不写 */
export function upsertArticleRead(article) {
  return null;
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
