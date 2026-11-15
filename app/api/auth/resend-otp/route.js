import { NextResponse } from "next/server";
import {
  authPhoneOtp,
  authResendOtp,
  hasServerSupabase,
} from "../../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/auth/resend-otp — 重发邮箱验证码，或发送手机 OTP */
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
  const type = String(body?.type || "signup").trim();

  if (!email && !phone) {
    return NextResponse.json(
      { error: "请提供邮箱或手机号" },
      { status: 400 },
    );
  }

  try {
    if (phone && !email) {
      await authPhoneOtp(phone, { createUser: true });
      return NextResponse.json({
        ok: true,
        channel: "sms",
        message: "验证码已发送",
      });
    }
    await authResendOtp({ email, phone, type });
    return NextResponse.json({
      ok: true,
      channel: email ? "email" : "sms",
      message: "验证码已重新发送",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "发送失败" },
      { status: e.status && e.status < 500 ? e.status : 400 },
    );
  }
}
