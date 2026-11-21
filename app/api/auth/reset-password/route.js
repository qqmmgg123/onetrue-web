import { NextResponse } from "next/server";
import { setSessionCookies } from "../../../../lib/server/session";
import {
  authUpdatePassword,
  authVerifyOtp,
  ensureProfileServer,
  hasServerSupabase,
} from "../../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/reset-password
 * 校验恢复 OTP 后设置新密码并建立会话。
 */
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
  const token = String(body?.token || body?.code || "").trim();
  const password = String(body?.password || body?.newPassword || "");

  if (!email) {
    return NextResponse.json({ error: "请填写邮箱" }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ error: "请填写验证码" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "新密码至少 6 位" }, { status: 400 });
  }

  try {
    const session = await authVerifyOtp({
      email,
      token,
      type: "recovery",
    });
    const user = session.user;
    if (!user?.id || !session.access_token) {
      return NextResponse.json({ error: "验证失败" }, { status: 401 });
    }

    await authUpdatePassword(session.access_token, password);

    let profile = null;
    try {
      profile = await ensureProfileServer(session.access_token, user, "");
    } catch (_) {
      profile = {
        id: user.id,
        nickname: "",
        avatarUrl: "",
        displayName: `用户${String(user.id).slice(0, 4)}`,
      };
    }

    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email || email,
        phone: user.phone || "",
      },
      profile,
      tokens: {
        access_token: session.access_token,
        refresh_token: session.refresh_token || "",
        expires_at:
          session.expires_at ||
          Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
      },
      message: "密码已重置",
    });
    setSessionCookies(res, session, request);
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "重置失败，请检查验证码是否正确" },
      { status: e.status && e.status < 500 ? e.status : 401 },
    );
  }
}
