import { NextResponse } from "next/server";
import { setSessionCookies } from "../../../../lib/server/session";
import {
  authSignUp,
  ensureProfileServer,
  hasServerSupabase,
} from "../../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sessionPayload(session, email, profile) {
  const user = session.user || {};
  return {
    ok: true,
    needsOtp: false,
    user: { id: user.id, email: user.email || email },
    profile,
    tokens: {
      access_token: session.access_token,
      refresh_token: session.refresh_token || "",
      expires_at:
        session.expires_at ||
        Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
    },
  };
}

/** POST /api/auth/signup — 邮箱+密码注册；开启邮箱确认时返回 needsOtp */
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
  if (password.length < 6) {
    return NextResponse.json(
      { error: "密码至少 6 位" },
      { status: 400 },
    );
  }
  if (!nickname) {
    return NextResponse.json({ error: "请填写昵称" }, { status: 400 });
  }

  try {
    const data = await authSignUp({ email, password, nickname });
    // 已自动确认：直接有 session
    if (data?.access_token && data?.user?.id) {
      let profile = null;
      try {
        profile = await ensureProfileServer(
          data.access_token,
          data.user,
          nickname,
        );
      } catch (_) {
        profile = {
          id: data.user.id,
          nickname,
          avatarUrl: "",
          displayName: nickname,
        };
      }
      const res = NextResponse.json(
        sessionPayload(data, email, profile),
      );
      setSessionCookies(res, data, request);
      return res;
    }

    // 需邮箱验证码确认
    return NextResponse.json({
      ok: true,
      needsOtp: true,
      channel: "email",
      email,
      message: "验证码已发送到邮箱，请查收后完成注册",
    });
  } catch (e) {
    const msg = e.message || "注册失败";
    const lower = String(msg).toLowerCase();
    let friendly = msg;
    if (lower.includes("already") || lower.includes("registered")) {
      friendly = "该邮箱已注册，请直接登录";
    }
    return NextResponse.json(
      { error: friendly },
      { status: e.status && e.status < 500 ? e.status : 400 },
    );
  }
}
