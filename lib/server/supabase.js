import {
  hasServerSupabase,
  supabaseAnonKey,
  supabaseServiceKey,
  supabaseUrl,
} from "./env";

export { hasServerSupabase };

function baseHeaders(token) {
  const key = supabaseAnonKey();
  return {
    apikey: key,
    Authorization: `Bearer ${token || key}`,
    Accept: "application/json",
  };
}

export async function authPasswordGrant(email, password) {
  const res = await fetch(
    `${supabaseUrl()}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        ...baseHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      data.error_description || data.msg || data.error || "登录失败",
    );
    err.status = res.status;
    throw err;
  }
  return data;
}

/** 用 refresh_token 换新的 access_token（与 App Supabase Auth 相同） */
export async function authRefreshGrant(refreshToken) {
  const rt = String(refreshToken || "").trim();
  if (!rt) {
    const err = new Error("缺少 refresh_token");
    err.status = 401;
    throw err;
  }
  const res = await fetch(
    `${supabaseUrl()}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        ...baseHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: rt }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      data.error_description || data.msg || data.error || "刷新登录失败",
    );
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function authGetUser(accessToken) {
  if (!accessToken) return null;
  const res = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: baseHeaders(accessToken),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function authSignOut(accessToken) {
  if (!accessToken) return;
  await fetch(`${supabaseUrl()}/auth/v1/logout`, {
    method: "POST",
    headers: baseHeaders(accessToken),
  }).catch(() => {});
}

/**
 * PostgREST GET
 * @param {string} path 如 /notes?select=...
 * @param {{ accessToken?: string, service?: boolean }} opts
 */
export async function restGet(path, opts = {}) {
  const key = opts.service && supabaseServiceKey()
    ? supabaseServiceKey()
    : supabaseAnonKey();
  const token = opts.accessToken || key;
  const res = await fetch(`${supabaseUrl()}/rest/v1${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(text || `REST ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function restUpsert(table, row, opts = {}) {
  const key = opts.service && supabaseServiceKey()
    ? supabaseServiceKey()
    : supabaseAnonKey();
  const token = opts.accessToken || key;
  const select = opts.select ? `?select=${encodeURIComponent(opts.select)}` : "";
  const res = await fetch(`${supabaseUrl()}/rest/v1/${table}${select}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(text || `UPSERT ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? data[0] : data;
}

export function asInt(v) {
  return typeof v === "number" ? v : parseInt(String(v ?? "0"), 10) || 0;
}

export function articleFromRow(row) {
  const map = row || {};
  let listedAt = null;
  if (map.listed_at) {
    listedAt =
      map.listed_at instanceof Date
        ? map.listed_at.toISOString()
        : String(map.listed_at);
  }
  let viewCount = 0;
  let recommendCount = 0;
  let commentCount = 0;
  const stats = map.note_stats;
  const statsMap = Array.isArray(stats) ? stats[0] : stats;
  if (statsMap && typeof statsMap === "object") {
    viewCount = asInt(statsMap.view_count);
    recommendCount = asInt(statsMap.recommend_count);
    commentCount = asInt(statsMap.comment_count);
  }
  return {
    id: String(map.id || ""),
    title: String(map.title || ""),
    body: String(map.body || ""),
    format: String(map.format || "plain"),
    city: String(map.city || ""),
    listedAt,
    ownerId: String(map.owner_id || ""),
    viewCount,
    recommendCount,
    commentCount,
  };
}

export function hotScore(article) {
  const listedAt = article.listedAt ? new Date(article.listedAt) : null;
  const ageHours = listedAt
    ? Math.min(
        24 * 90,
        Math.max(0, (Date.now() - listedAt.getTime()) / 3600000),
      )
    : 24 * 30;
  const recency =
    Math.max(0, Math.min(24 * 14, 24 * 14 - ageHours)) / (24 * 14);
  return (
    (article.recommendCount || 0) * 5 +
    (article.commentCount || 0) * 3 +
    (article.viewCount || 0) +
    recency * 10
  );
}

export const ARTICLE_SELECT =
  "id,title,body,format,city,listed_at,owner_id,note_stats(view_count,recommend_count,comment_count)";

export async function fetchListedArticlesServer({
  city = "",
  ownerId = "",
  accessToken = "",
} = {}) {
  const params = [
    `select=${encodeURIComponent(ARTICLE_SELECT)}`,
    "deleted_at=is.null",
    "kind=eq.article",
    "listing_status=eq.listed",
    "order=listed_at.desc",
    "limit=200",
  ];
  if (ownerId.trim()) {
    params.push(`owner_id=eq.${ownerId.trim()}`);
  }
  if (city.trim()) {
    params.push(`or=(city.eq.${city.trim()},city.eq.)`);
  }
  const rows = await restGet(`/notes?${params.join("&")}`, { accessToken });
  const list = (rows || []).map(articleFromRow);
  list.sort((a, b) => hotScore(b) - hotScore(a));
  return list;
}

export async function fetchArticleByIdServer(id, accessToken = "") {
  if (!id) return null;
  const params = [
    `select=${encodeURIComponent(ARTICLE_SELECT)}`,
    `id=eq.${id}`,
    "deleted_at=is.null",
    "kind=eq.article",
    "listing_status=eq.listed",
    "limit=1",
  ];
  const rows = await restGet(`/notes?${params.join("&")}`, { accessToken });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row ? articleFromRow(row) : null;
}

export async function fetchProfileServer(userId, accessToken = "") {
  if (!userId) return null;
  const rows = await restGet(
    `/profiles?select=id,nickname,avatar_url&id=eq.${userId}&limit=1`,
    { accessToken },
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return null;
  return {
    id: row.id,
    nickname: row.nickname || "",
    avatarUrl: row.avatar_url || "",
    displayName:
      (row.nickname || "").trim() || `用户${String(row.id).slice(0, 4)}`,
  };
}

export async function ensureProfileServer(accessToken, user, nickname = "") {
  const uid = user?.id;
  if (!uid || !accessToken) return null;
  const existing = await fetchProfileServer(uid, accessToken);
  if (existing && existing.nickname.trim()) return existing;
  const nick =
    nickname.trim() ||
    existing?.nickname?.trim() ||
    `用户${uid.slice(0, 4)}`;
  const row = await restUpsert(
    "profiles",
    {
      id: uid,
      nickname: nick,
      updated_at: new Date().toISOString(),
    },
    {
      accessToken,
      select: "id,nickname,avatar_url",
    },
  );
  if (!row) {
    return {
      id: uid,
      nickname: nick,
      avatarUrl: "",
      displayName: nick,
    };
  }
  return {
    id: row.id,
    nickname: row.nickname || nick,
    avatarUrl: row.avatar_url || "",
    displayName: (row.nickname || nick).trim(),
  };
}
