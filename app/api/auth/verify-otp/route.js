import { NextResponse } from "next/server";
import { setSessionCookies } from "../../../../lib/server/session";
import {
  authVerifyOtp,
  ensureProfileServer,
  hasServerSupabase,
} from "../../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/auth/verify-otp — 邮箱/短信验证码换会话 */
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
  const phone = String(body?.phone || "").trim();
  const token = String(body?.token || body?.code || "").trim();
  const type = String(body?.type || (phone ? "sms" : "signup")).trim();
  const nickname = String(body?.nickname || "").trim();

  if (!token) {
    return NextResponse.json({ error: "请填写验证码" }, { status: 400 });
  }
  if (!email && !phone) {
    return NextResponse.json(
      { error: "请提供邮箱或手机号" },
      { status: 400 },
    );
  }

  try {
    const session = await authVerifyOtp({ email, phone, token, type });
    const user = session.user;
    if (!user?.id || !session.access_token) {
      return NextResponse.json({ error: "验证失败" }, { status: 401 });
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

    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email || email || "",
        phone: user.phone || phone || "",
      },
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
      { error: e.message || "验证码错误或已过期" },
      { status: e.status && e.status < 500 ? e.status : 401 },
    );
  }
}
