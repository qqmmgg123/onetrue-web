import { cookies } from "next/headers";

export const COOKIE_ACCESS = "tihu_at";
export const COOKIE_REFRESH = "tihu_rt";
export const COOKIE_USER = "tihu_uid";

const WEEK = 60 * 60 * 24 * 7;

/** http:// 站点不能发 Secure Cookie，否则浏览器丢弃 → 界面像已登录但 /api/* 全 401 */
function wantSecure(request) {
  const flag = String(process.env.COOKIE_SECURE || "").trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "no") return false;
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  const xf = (
    request?.headers?.get?.("x-forwarded-proto") ||
    request?.headers?.get?.("X-Forwarded-Proto") ||
    ""
  )
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (xf === "https") return true;
  if (xf === "http") return false;
  return false;
}

function cookieOpts(maxAge = WEEK, request) {
  return {
    httpOnly: true,
    secure: wantSecure(request),
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export function readSessionFromCookies() {
  const jar = cookies();
  const accessToken = jar.get(COOKIE_ACCESS)?.value || "";
  const refreshToken = jar.get(COOKIE_REFRESH)?.value || "";
  const userId = jar.get(COOKIE_USER)?.value || "";
  // access 过期被清掉后仍可能剩 refresh，供 /api/auth/refresh 使用
  if (!accessToken && !refreshToken) return null;
  return { accessToken, refreshToken, userId };
}

/** 同时支持 Cookie 与 Authorization: Bearer（方便以后 App 调用） */
export function readAccessToken(request) {
  const auth = request?.headers?.get?.("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  return readSessionFromCookies()?.accessToken || "";
}

export function setSessionCookies(res, session, request) {
  const opts = cookieOpts(session.expires_in || WEEK, request);
  res.cookies.set(COOKIE_ACCESS, session.access_token, opts);
  if (session.refresh_token) {
    res.cookies.set(COOKIE_REFRESH, session.refresh_token, {
      ...opts,
      maxAge: WEEK * 4,
    });
  }
  if (session.user?.id) {
    res.cookies.set(COOKIE_USER, session.user.id, {
      ...opts,
      maxAge: WEEK * 4,
    });
  }
}

export function clearSessionCookies(res) {
  const base = { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 };
  for (const secure of [false, true]) {
    const opts = { ...base, secure };
    res.cookies.set(COOKIE_ACCESS, "", opts);
    res.cookies.set(COOKIE_REFRESH, "", opts);
    res.cookies.set(COOKIE_USER, "", opts);
  }
}
