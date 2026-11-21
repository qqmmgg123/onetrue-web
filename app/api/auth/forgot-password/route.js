import { NextResponse } from "next/server";
import {
  authRecoverPassword,
  hasServerSupabase,
} from "../../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/auth/forgot-password — 发送重置密码邮箱验证码 */
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
  if (!email) {
    return NextResponse.json({ error: "请填写邮箱" }, { status: 400 });
  }

  try {
    // 无论邮箱是否存在都返回成功文案，避免枚举账号
    await authRecoverPassword(email);
    return NextResponse.json({
      ok: true,
      channel: "email",
      email,
      message: "若该邮箱已注册，验证码将发送到邮箱",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "发送失败" },
      { status: e.status && e.status < 500 ? e.status : 400 },
    );
  }
}
