import {
  supabaseAnonKey,
  supabaseServiceKey,
  supabaseUrl,
} from "./env";

function pickKey(opts = {}) {
  if (opts.service && supabaseServiceKey()) return supabaseServiceKey();
  return supabaseAnonKey();
}

export async function restRequest(
  method,
  pathWithQuery,
  { accessToken = "", body, service = false, headers: extra = {} } = {},
) {
  const key = pickKey({ service });
  const token = accessToken || key;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...extra,
  };
  let payload;
  if (body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
    payload = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await fetch(`${supabaseUrl()}/rest/v1${pathWithQuery}`, {
    method,
    headers,
    body: payload,
    cache: "no-store",
  });
  const text = await res.text().catch(() => "");
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = text;
    }
  }
  if (!res.ok) {
    let msg =
      (data && (data.message || data.error_description || data.msg)) ||
      (typeof data?.error === "string" ? data.error : null) ||
      text ||
      `HTTP ${res.status}`;
    if (typeof msg !== "string") msg = JSON.stringify(msg);
    // PostgREST 常把细节放在 details/hint
    if (data?.details && !msg.includes(String(data.details))) {
      msg = `${msg} (${data.details})`;
    }
    const err = new Error(msg);
    err.status = res.status;
    err.code = data?.code || "";
    err.data = data;
    throw err;
  }
  return data;
}

export function restGet(path, opts) {
  return restRequest("GET", path, opts);
}

export function restPost(path, body, opts = {}) {
  return restRequest("POST", path, {
    ...opts,
    body,
    headers: {
      Prefer: opts.prefer || "return=representation",
      ...opts.headers,
    },
  });
}

export function restPatch(path, body, opts = {}) {
  return restRequest("PATCH", path, {
    ...opts,
    body,
    headers: {
      Prefer: opts.prefer || "return=representation",
      ...opts.headers,
    },
  });
}

export function restDelete(path, opts = {}) {
  return restRequest("DELETE", path, {
    ...opts,
    headers: {
      Prefer: opts.prefer || "return=representation",
      ...opts.headers,
    },
  });
}
