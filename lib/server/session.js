import { cookies } from "next/headers";

export const COOKIE_ACCESS = "tihu_at";
export const COOKIE_REFRESH = "tihu_rt";
export const COOKIE_USER = "tihu_uid";

const WEEK = 60 * 60 * 24 * 7;

function cookieOpts(maxAge = WEEK) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
  if (!accessToken) return null;
  return { accessToken, refreshToken, userId };
}

/** 同时支持 Cookie 与 Authorization: Bearer（方便以后 App 调用） */
export function readAccessToken(request) {
  const auth = request?.headers?.get?.("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  return readSessionFromCookies()?.accessToken || "";
}

export function setSessionCookies(res, session) {
  const opts = cookieOpts(session.expires_in || WEEK);
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
  const opts = { ...cookieOpts(0), maxAge: 0 };
  res.cookies.set(COOKIE_ACCESS, "", opts);
  res.cookies.set(COOKIE_REFRESH, "", opts);
  res.cookies.set(COOKIE_USER, "", opts);
}
