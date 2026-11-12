"use client";

/** 浏览器只打本站 /api/*，不直连 Supabase */

async function api(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body != null ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
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
    const err = new Error(msg);
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
