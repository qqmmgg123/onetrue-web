"use client";

/** 浏览器只打本站 /api/* */

async function api(path, { method = "GET", body, headers, formData } = {}) {
  const init = {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...headers,
    },
  };
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
    const msg =
      data?.error || data?.message || data?.raw || `请求失败 (${res.status})`;
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function apiHealth() {
  return api("/api/health");
}

export async function apiLogin({ email, password, nickname }) {
  return api("/api/auth/login", {
    method: "POST",
    body: { email, password, nickname },
  });
}

export async function apiLogout() {
  return api("/api/auth/logout", { method: "POST" });
}

export async function apiMe() {
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
  const data = await api(`/api/articles/${encodeURIComponent(id)}`);
  return data?.article || null;
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

export async function apiFetchNotes() {
  const data = await api("/api/notes");
  return data?.notes || [];
}

export async function apiCreateNote(payload) {
  const data = await api("/api/notes", { method: "POST", body: payload });
  return data?.note;
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
  return data?.reply || data?.content || "";
}
