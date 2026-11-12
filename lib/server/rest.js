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
    const msg =
      (data && (data.message || data.error_description || data.error)) ||
      text ||
      `HTTP ${res.status}`;
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = res.status;
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
