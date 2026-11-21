"use client";

/** 浏览器只打本站 /api/* */

import { userFacingError } from "./user-facing-error";

export const LEGACY_SESSION_KEY = "tihu.supabase.session";
export const AUTH_EXPIRED_EVENT = "tihu:auth-expired";

function readClientSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.access_token && !s?.refresh_token) return null;
    return s;
  } catch (_) {
    return null;
  }
}

function writeClientSession(tokens, user) {
  if (typeof window === "undefined") return;
  if (!tokens?.access_token) {
    localStorage.removeItem(LEGACY_SESSION_KEY);
    return;
  }
  const prev = readClientSession();
  localStorage.setItem(
    LEGACY_SESSION_KEY,
    JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || prev?.refresh_token || "",
      expires_at: tokens.expires_at || 0,
      user: user || prev?.user || null,
    }),
  );
}

function clearClientSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_SESSION_KEY);
}

function emitAuthExpired() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  } catch (_) {}
}

function isAuthFailure(status, msg) {
  if (status === 401) return true;
  const m = String(msg || "").toLowerCase();
  return (
    m.includes("jwt expired") ||
    m.includes("invalid jwt") ||
    m.includes("jwt") && m.includes("expired") ||
    m.includes("登录失效") ||
    m.includes("请先登录") ||
    m.includes("登录已过期")
  );
}

function friendlyErrorMessage(status, raw) {
  const msg = typeof raw === "string" ? raw : String(raw || "");
  if (isAuthFailure(status, msg)) return "登录已过期，请重新登录";
  return userFacingError(msg, `请求失败 (${status})`);
}

let refreshInFlight = null;

/** 用 refresh_token 换新 access；成功写回 localStorage + Cookie */
export async function apiRefreshSession() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const session = readClientSession();
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        session?.refresh_token
          ? { refresh_token: session.refresh_token }
          : {},
      ),
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = null;
    }
    if (!res.ok || !data?.tokens?.access_token) {
      clearClientSession();
      emitAuthExpired();
      return null;
    }
    writeClientSession(data.tokens, data.user || session?.user);
    return data;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** 接近过期时先刷新，避免把过期 JWT 打到业务 API */
export async function ensureFreshClientToken() {
  const session = readClientSession();
  if (!session?.refresh_token) return session;
  const exp = Number(session.expires_at) || 0;
  const now = Math.floor(Date.now() / 1000);
  if (exp && exp - now > 90) return session;
  const refreshed = await apiRefreshSession();
  return refreshed ? readClientSession() : null;
}

async function api(path, opts = {}) {
  const {
    method = "GET",
    body,
    headers,
    formData,
    _retried = false,
    skipAuthRefresh = false,
  } = opts;

  if (!skipAuthRefresh && !path.startsWith("/api/auth/")) {
    await ensureFreshClientToken().catch(() => {});
  }

  const init = {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...headers,
    },
  };
  const token = readClientSession()?.access_token || "";
  if (token && !init.headers.Authorization && !init.headers.authorization) {
    init.headers.Authorization = `Bearer ${token}`;
  }
  if (formData) {
    init.body = formData;
  } else if (body != null) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(path, init);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = { raw: text };
  }
  if (!res.ok) {
    const rawMsg =
      data?.error || data?.message || data?.raw || `请求失败 (${res.status})`;
    const rawStr = typeof rawMsg === "string" ? rawMsg : JSON.stringify(rawMsg);

    const canRefresh =
      !skipAuthRefresh &&
      !_retried &&
      path !== "/api/auth/refresh" &&
      path !== "/api/auth/login" &&
      isAuthFailure(res.status, rawStr);

    if (canRefresh) {
      const refreshed = await apiRefreshSession();
      if (refreshed?.tokens?.access_token) {
        return api(path, { ...opts, _retried: true });
      }
      const err = new Error("登录已过期，请重新登录");
      err.status = 401;
      err.authExpired = true;
      err.data = data;
      throw err;
    }

    // 登录/注册等业务 401 不要统一改成「登录已过期」
    const authFormPath =
      path.startsWith("/api/auth/login") ||
      path.startsWith("/api/auth/signup") ||
      path.startsWith("/api/auth/verify-otp") ||
      path.startsWith("/api/auth/resend-otp") ||
      path.startsWith("/api/auth/forgot-password") ||
      path.startsWith("/api/auth/reset-password");
    const err = new Error(
      authFormPath
        ? userFacingError(rawStr, rawStr)
        : friendlyErrorMessage(res.status, rawStr),
    );
    err.status = res.status;
    err.data = data;
    err.code = data?.code || "";
    err.needsOtp = Boolean(data?.needsOtp);
    if (!authFormPath && isAuthFailure(res.status, rawStr)) {
      err.authExpired = true;
    }
    throw err;
  }
  return data;
}

export async function apiHealth() {
  return api("/api/health", { skipAuthRefresh: true });
}

export async function apiLogin({ email, password, nickname }) {
  const data = await api("/api/auth/login", {
    method: "POST",
    body: { email, password, nickname },
    skipAuthRefresh: true,
  });
  if (data?.tokens) writeClientSession(data.tokens, data.user);
  return data;
}

export async function apiSignup({ email, password, nickname }) {
  return api("/api/auth/signup", {
    method: "POST",
    body: { email, password, nickname },
    skipAuthRefresh: true,
  });
}

export async function apiVerifyOtp({
  email,
  phone,
  token,
  type,
  nickname,
} = {}) {
  const data = await api("/api/auth/verify-otp", {
    method: "POST",
    body: { email, phone, token, type, nickname },
    skipAuthRefresh: true,
  });
  if (data?.tokens) writeClientSession(data.tokens, data.user);
  return data;
}

export async function apiResendOtp({ email, phone, type } = {}) {
  return api("/api/auth/resend-otp", {
    method: "POST",
    body: { email, phone, type },
    skipAuthRefresh: true,
  });
}

export async function apiForgotPassword({ email } = {}) {
  return api("/api/auth/forgot-password", {
    method: "POST",
    body: { email },
    skipAuthRefresh: true,
  });
}

export async function apiResetPassword({ email, token, password } = {}) {
  const data = await api("/api/auth/reset-password", {
    method: "POST",
    body: { email, token, password },
    skipAuthRefresh: true,
  });
  if (data?.tokens) writeClientSession(data.tokens, data.user);
  return data;
}

export async function apiLogout() {
  try {
    return await api("/api/auth/logout", {
      method: "POST",
      skipAuthRefresh: true,
    });
  } finally {
    clearClientSession();
  }
}

export async function apiMe() {
  await ensureFreshClientToken().catch(() => {});
  return api("/api/auth/me");
}

export async function apiFetchArticles({ city = "", ownerId = "" } = {}) {
  const q = new URLSearchParams();
  if (city) q.set("city", city);
  if (ownerId) q.set("ownerId", ownerId);
  const qs = q.toString();
  const data = await api(`/api/articles${qs ? `?${qs}` : ""}`);
  return data?.articles || [];
}

export async function apiFetchArticle(id) {
  if (!id) return null;
  try {
    const data = await api(`/api/articles/${encodeURIComponent(id)}`);
    return data?.article || null;
  } catch (e) {
    // 404 携带 status: deleted | delisted，供阅读入口区分提示
    if (e?.status === 404 && e?.data?.error) {
      e.message = e.data.error;
    }
    throw e;
  }
}

export async function apiIncrementArticleView(id) {
  if (!id) return null;
  return api(`/api/articles/${encodeURIComponent(id)}/view`, {
    method: "POST",
  });
}

export async function apiFetchProfiles(ids) {
  const list = [...new Set((ids || []).filter(Boolean))];
  if (!list.length) return {};
  const data = await api(`/api/profile?ids=${encodeURIComponent(list.join(","))}`);
  return data?.profiles || {};
}

export async function apiUpdateProfile({ nickname, avatarUrl } = {}) {
  const data = await api("/api/profile", {
    method: "PATCH",
    body: { nickname, avatarUrl },
  });
  return data?.profile;
}

export async function apiUploadAvatar(file) {
  // 优先：拿凭证后浏览器直传七牛（国内稳）；失败再走服务端代传
  try {
    const cred = await api("/api/profile/avatar-token", { method: "POST" });
    const fd = new FormData();
    fd.append("token", cred.token);
    fd.append("key", cred.key);
    fd.append("file", file, "avatar.jpg");
    const up = await fetch(cred.uploadHost, { method: "POST", body: fd });
    if (!up.ok) {
      const t = await up.text().catch(() => "");
      throw new Error(t || `七牛上传失败 ${up.status}`);
    }
    const profile = await apiUpdateProfile({ avatarUrl: cred.publicUrl });
    return { avatarUrl: cred.publicUrl, profile };
  } catch (e) {
    const fd = new FormData();
    fd.append("file", file);
    return api("/api/profile/avatar", { method: "POST", formData: fd });
  }
}

/** 文章封面 / 正文插图直传七牛；kind: covers | note-images */
export async function apiUploadNoteImage(file, { kind = "note-images" } = {}) {
  if (!file) throw new Error("缺少图片");
  const cred = await api("/api/media/upload-token", {
    method: "POST",
    body: { kind },
  });
  const fd = new FormData();
  fd.append("token", cred.token);
  fd.append("key", cred.key);
  fd.append("file", file, file.name || "image.jpg");
  const up = await fetch(cred.uploadHost, { method: "POST", body: fd });
  if (!up.ok) {
    const t = await up.text().catch(() => "");
    throw new Error(t || `上传失败 ${up.status}`);
  }
  return { url: cred.publicUrl, key: cred.key };
}

export async function apiFetchNotes({
  limit = 40,
  offset = 0,
  kind = "",
} = {}) {
  const q = new URLSearchParams();
  q.set("limit", String(limit));
  q.set("offset", String(offset));
  if (kind) q.set("kind", kind);
  const data = await api(`/api/notes?${q.toString()}`);
  return {
    notes: data?.notes || [],
    hasMore: Boolean(data?.hasMore),
    limit: data?.limit ?? limit,
    offset: data?.offset ?? offset,
  };
}

export async function apiFetchAdmonitions({ limit = 40 } = {}) {
  const q = new URLSearchParams();
  q.set("limit", String(limit));
  const data = await api(`/api/admonitions?${q.toString()}`);
  return data?.notes || [];
}

export async function apiCreateNote(payload) {
  const data = await api("/api/notes", { method: "POST", body: payload });
  return data?.note;
}

export async function apiUpdateNote(id, payload) {
  if (!id) throw new Error("缺少笔记 id");
  const data = await api(`/api/notes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: payload,
  });
  return data?.note;
}

export async function apiDeleteNote(id) {
  if (!id) throw new Error("缺少笔记 id");
  return api(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function apiFetchNote(id) {
  if (!id) return null;
  const data = await api(`/api/notes/${encodeURIComponent(id)}`);
  return data?.note || null;
}

export async function apiFollowingFeed() {
  const data = await api("/api/social/following-feed");
  return data?.articles || [];
}

export async function apiFavorites() {
  const data = await api("/api/social/favorite");
  return data?.articles || [];
}

export async function apiNotifications() {
  const data = await api("/api/social/notifications");
  return data?.notifications || [];
}

export async function apiSocialStatus({ noteId, ownerId }) {
  const q = new URLSearchParams();
  if (noteId) q.set("noteId", noteId);
  if (ownerId) q.set("ownerId", ownerId);
  return api(`/api/social/status?${q}`);
}

export async function apiToggleFollow(userId) {
  return api("/api/social/follow", { method: "POST", body: { userId } });
}

export async function apiToggleRecommend({ noteId, ownerId }) {
  return api("/api/social/recommend", {
    method: "POST",
    body: { noteId, ownerId },
  });
}

export async function apiToggleFavorite(noteId) {
  return api("/api/social/favorite", { method: "POST", body: { noteId } });
}

export async function apiListComments(noteId) {
  const data = await api(
    `/api/social/comments?noteId=${encodeURIComponent(noteId)}`,
  );
  return data?.comments || [];
}

export async function apiAddComment(payload) {
  const data = await api("/api/social/comments", {
    method: "POST",
    body: payload,
  });
  return data?.comment;
}

export async function apiChat(messages) {
  const data = await api("/api/ai/chat", {
    method: "POST",
    body: { messages },
  });
  return {
    reply: data?.reply || data?.content || "",
    pending: data?.pending || null,
  };
}

export async function apiConfirmAi(pending) {
  return api("/api/ai/confirm", {
    method: "POST",
    body: { pending },
  });
}

export async function apiNoteDraftAi(payload) {
  return api("/api/ai/note-draft", {
    method: "POST",
    body: payload,
  });
}

export async function apiFetchFeedback() {
  const data = await api("/api/feedback");
  return data?.items || [];
}

export async function apiSubmitFeedback({ body, contact } = {}) {
  const data = await api("/api/feedback", {
    method: "POST",
    body: { body, contact },
  });
  return data?.item;
}

/** 登录用户云端近期阅读（游客勿调） */
export async function apiFetchReads() {
  const data = await api("/api/reads");
  return data?.items || [];
}

export async function apiUpsertRead(article) {
  const data = await api("/api/reads", {
    method: "POST",
    body: {
      id: article?.id,
      title: article?.title,
      body: article?.body,
      format: article?.format,
      city: article?.city,
      ownerId: article?.ownerId,
    },
  });
  return data?.item;
}

/** 识图：multipart file + prompt */
export async function apiVisionUnderstand({ file, prompt } = {}) {
  if (!file) throw new Error("缺少图片");
  const fd = new FormData();
  fd.append("file", file, file.name || "image.jpg");
  if (prompt) fd.append("prompt", prompt);
  const data = await api("/api/ai/vision", { method: "POST", formData: fd });
  return {
    text: String(data?.text || "").trim(),
    source: data?.source || "vision",
  };
}
