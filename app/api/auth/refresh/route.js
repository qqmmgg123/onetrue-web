import { NextResponse } from "next/server";
import {
  clearSessionCookies,
  readSessionFromCookies,
  setSessionCookies,
} from "../../../../lib/server/session";
import {
  authRefreshGrant,
  hasServerSupabase,
} from "../../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/auth/refresh — Cookie 或 body.refresh_token 换新会话 */
export async function POST(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "服务端未配置" }, { status: 503 });
  }

  let refreshToken = readSessionFromCookies()?.refreshToken || "";
  try {
    const body = await request.json();
    if (body?.refresh_token) refreshToken = String(body.refresh_token).trim();
  } catch (_) {}

  if (!refreshToken) {
    const res = NextResponse.json(
      { error: "登录已过期，请重新登录" },
      { status: 401 },
    );
    clearSessionCookies(res);
    return res;
  }

  try {
    const session = await authRefreshGrant(refreshToken);
    if (!session?.access_token) {
      throw Object.assign(new Error("刷新失败"), { status: 401 });
    }
    const expiresAt =
      session.expires_at ||
      Math.floor(Date.now() / 1000) + (session.expires_in || 3600);
    const res = NextResponse.json({
      ok: true,
      user: session.user
        ? { id: session.user.id, email: session.user.email || "" }
        : null,
      tokens: {
        access_token: session.access_token,
        refresh_token: session.refresh_token || refreshToken,
        expires_at: expiresAt,
      },
    });
    setSessionCookies(res, session, request);
    return res;
  } catch (e) {
    const res = NextResponse.json(
      { error: "登录已过期，请重新登录" },
      { status: e.status && e.status < 500 ? e.status : 401 },
    );
    clearSessionCookies(res);
    return res;
  }
}
