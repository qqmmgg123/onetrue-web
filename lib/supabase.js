"use client";

/** 轻量 Supabase 客户端（Auth + PostgREST），避免额外 npm 依赖。 */

const STORAGE_KEY = "tihu.supabase.session";

function url() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
}

function anonKey() {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
}

export function hasSupabase() {
  return Boolean(url() && anonKey());
}

export function functionsBase() {
  const u = url();
  return u ? `${u}/functions/v1` : "";
}

function loadSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function saveSession(session) {
  if (typeof window === "undefined") return;
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

const listeners = new Set();

function emit(session) {
  for (const fn of listeners) {
    try {
      fn(session);
    } catch (_) {}
  }
}

async function refreshIfNeeded(session) {
  if (!session?.refresh_token) return session;
  const exp = session.expires_at || 0;
  const now = Math.floor(Date.now() / 1000);
  if (exp && exp - now > 60) return session;
  const res = await fetch(`${url()}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: anonKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) {
    saveSession(null);
    emit(null);
    return null;
  }
  const data = await res.json();
  const next = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || session.refresh_token,
    expires_at: data.expires_at
      || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    user: data.user || session.user,
  };
  saveSession(next);
  emit(next);
  return next;
}

export function getSupabase() {
  if (!hasSupabase()) {
    throw new Error("未配置 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");
  }

  const api = {
    auth: {
      async getSession() {
        let session = loadSession();
        session = await refreshIfNeeded(session);
        return { data: { session } };
      },
      async getUser() {
        const { data } = await api.auth.getSession();
        return { data: { user: data.session?.user || null } };
      },
      async signInWithPassword({ email, password }) {
        const res = await fetch(`${url()}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: {
            apikey: anonKey(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error_description || data.msg || data.error || "登录失败");
        }
        const session = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at
            || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
          user: data.user,
        };
        saveSession(session);
        emit(session);
        return { data: { user: data.user, session }, error: null };
      },
      async signOut() {
        const session = loadSession();
        if (session?.access_token) {
          try {
            await fetch(`${url()}/auth/v1/logout`, {
              method: "POST",
              headers: {
                apikey: anonKey(),
                Authorization: `Bearer ${session.access_token}`,
              },
            });
          } catch (_) {}
        }
        saveSession(null);
        emit(null);
      },
      onAuthStateChange(cb) {
        const wrap = (session) => cb(session ? "SIGNED_IN" : "SIGNED_OUT", session);
        listeners.add(wrap);
        return {
          data: {
            subscription: {
              unsubscribe() {
                listeners.delete(wrap);
              },
            },
          },
        };
      },
    },

    from(table) {
      return createQuery(table);
    },
  };

  return api;
}

function createQuery(table) {
  const state = {
    table,
    selectCols: "*",
    filters: [],
    order: null,
    limitN: null,
    single: false,
    maybe: false,
    method: "GET",
    body: null,
    upsert: false,
  };

  const q = {
    select(cols) {
      state.selectCols = cols || "*";
      return q;
    },
    eq(col, val) {
      state.filters.push(`${col}=eq.${encodeFilter(val)}`);
      return q;
    },
    in(col, vals) {
      const list = (vals || []).map(encodeFilter).join(",");
      state.filters.push(`${col}=in.(${list})`);
      return q;
    },
    is(col, val) {
      if (val === null) state.filters.push(`${col}=is.null`);
      else state.filters.push(`${col}=is.${encodeFilter(val)}`);
      return q;
    },
    or(expr) {
      state.filters.push(`or=(${expr})`);
      return q;
    },
    order(col, { ascending = true } = {}) {
      state.order = `${col}.${ascending ? "asc" : "desc"}`;
      return q;
    },
    limit(n) {
      state.limitN = n;
      return q;
    },
    maybeSingle() {
      state.maybe = true;
      state.single = true;
      return q;
    },
    single() {
      state.single = true;
      return q;
    },
    insert(row) {
      state.method = "POST";
      state.body = row;
      return q;
    },
    upsert(row) {
      state.method = "POST";
      state.body = row;
      state.upsert = true;
      return q;
    },
    update(row) {
      state.method = "PATCH";
      state.body = row;
      return q;
    },
    delete() {
      state.method = "DELETE";
      return q;
    },
    then(resolve, reject) {
      return execute(state).then(resolve, reject);
    },
  };

  // allow await query after mutating builders that return thenable
  return q;
}

function encodeFilter(val) {
  if (val === null || val === undefined) return "null";
  if (typeof val === "boolean" || typeof val === "number") return String(val);
  const s = String(val);
  // 简单值无需引号；含逗号/空格等再加双引号
  if (/^[A-Za-z0-9_.:@+-]+$/.test(s)) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}

async function execute(state) {
  const session = await refreshIfNeeded(loadSession());
  const token = session?.access_token || anonKey();
  const headers = {
    apikey: anonKey(),
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  let path = `${url()}/rest/v1/${state.table}`;
  const params = [];

  if (state.method === "GET" || state.method === "PATCH" || state.method === "DELETE") {
    if (state.selectCols && state.method === "GET") {
      params.push(`select=${encodeURIComponent(state.selectCols)}`);
    }
    for (const f of state.filters) params.push(f);
    if (state.order) params.push(`order=${state.order}`);
    if (state.limitN != null) params.push(`limit=${state.limitN}`);
  } else if (state.method === "POST") {
    // Prefer returning representation when select chained after insert/upsert
    headers.Prefer = state.upsert
      ? "resolution=merge-duplicates,return=representation"
      : "return=representation";
    if (state.selectCols && state.selectCols !== "*") {
      params.push(`select=${encodeURIComponent(state.selectCols)}`);
    }
  }

  if (state.method === "PATCH" || state.method === "DELETE") {
    headers.Prefer = "return=representation";
    for (const f of state.filters) params.push(f);
  }

  if (params.length) path += `?${params.join("&")}`;

  if (state.body != null) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(path, {
    method: state.method,
    headers,
    body: state.body != null ? JSON.stringify(state.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.message || j.error_description || j.msg || text;
    } catch (_) {}
    return { data: null, error: new Error(msg || `HTTP ${res.status}`) };
  }

  if (res.status === 204) return { data: null, error: null };

  const data = await res.json().catch(() => null);
  if (state.single) {
    const row = Array.isArray(data) ? data[0] : data;
    if (!row && !state.maybe) {
      return { data: null, error: new Error("未找到记录") };
    }
    return { data: row || null, error: null };
  }
  return { data, error: null };
}
