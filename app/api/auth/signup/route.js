import { NextResponse } from "next/server";
import { setSessionCookies } from "../../../../lib/server/session";
import {
  authResendOtp,
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

    // Confirm email 开启时：已注册且已验证的邮箱会「静默成功」且 identities 为空、不发信
    const identities = data?.user?.identities;
    if (Array.isArray(identities) && identities.length === 0) {
      return NextResponse.json(
        {
          error: "该邮箱已注册，请直接登录",
          code: "already_registered",
        },
        { status: 400 },
      );
    }

    // 新注册或「已登记未验证」：再主动 resend 一次，避免只进验证页却没信
    let mailHint = "验证码已发送到邮箱，请查收后完成注册";
    try {
      await authResendOtp({ email, type: "signup" });
    } catch (mailErr) {
      const m = String(mailErr?.message || "").toLowerCase();
      if (m.includes("rate") || m.includes("security purposes")) {
        mailHint =
          "验证码发送较频繁，请稍后再点「重发验证码」，或查收此前邮件（含垃圾箱）";
      }
    }

    return NextResponse.json({
      ok: true,
      needsOtp: true,
      channel: "email",
      email,
      message: mailHint,
    });
  } catch (e) {
    const msg = e.message || "注册失败";
    const lower = String(msg).toLowerCase();
    let friendly = msg;
    if (lower.includes("already") || lower.includes("registered")) {
      friendly = "该邮箱已注册，请直接登录；若尚未验证，请点「去验证邮箱」";
    }
    return NextResponse.json(
      { error: friendly },
      { status: e.status && e.status < 500 ? e.status : 400 },
    );
  }
}
