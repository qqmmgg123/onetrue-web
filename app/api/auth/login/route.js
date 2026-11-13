import { NextResponse } from "next/server";
import { setSessionCookies } from "../../../../lib/server/session";
import {
  authPasswordGrant,
  ensureProfileServer,
  hasServerSupabase,
} from "../../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "服务端未配置 Supabase" },
      { status: 503 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const email = String(body?.email || "").trim();
  const password = String(body?.password || "");
  const nickname = String(body?.nickname || "").trim();

  if (!email || !password) {
    return NextResponse.json(
      { error: "请填写邮箱和密码" },
      { status: 400 },
    );
  }

  try {
    const session = await authPasswordGrant(email, password);
    const user = session.user;
    if (!user?.id) {
      return NextResponse.json({ error: "登录失败" }, { status: 401 });
    }

    let profile = null;
    try {
      profile = await ensureProfileServer(
        session.access_token,
        user,
        nickname,
      );
    } catch (_) {
      profile = {
        id: user.id,
        nickname: nickname || "",
        avatarUrl: "",
        displayName:
          nickname || `用户${String(user.id).slice(0, 4)}`,
      };
    }

    // tokens：App 用 Authorization Bearer；Web Cookie 为主，兼作过渡期直连桥接
    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email || email },
      profile,
      tokens: {
        access_token: session.access_token,
        refresh_token: session.refresh_token || "",
        expires_at:
          session.expires_at ||
          Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
      },
    });
    setSessionCookies(res, session, request);
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "登录失败" },
      { status: e.status && e.status < 500 ? e.status : 401 },
    );
  }
}
