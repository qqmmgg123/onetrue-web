import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import { hasServerSupabase } from "../../../../lib/server/env";
import { authGetUser } from "../../../../lib/server/supabase";
import { WRITE_TOOLS, commitTool } from "../../../../lib/server/ai-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 用户确认后执行挂起的写工具 */
export async function POST(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "未配置" }, { status: 503 });
  }
  const token = readAccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const user = await authGetUser(token);
  if (!user?.id) {
    return NextResponse.json({ error: "登录失效" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const pending = body?.pending || body;
  const tool = String(pending?.tool || "").trim();
  const args = pending?.args && typeof pending.args === "object" ? pending.args : {};
  if (!WRITE_TOOLS.has(tool)) {
    return NextResponse.json({ error: "无效操作" }, { status: 400 });
  }

  try {
    const result = await commitTool(token, user.id, tool, args);
    return NextResponse.json({ result, reply: result });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "执行失败" },
      { status: 502 },
    );
  }
}
