import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { readAccessToken } from "../../../lib/server/session";
import { authGetUser, hasServerSupabase } from "../../../lib/server/supabase";
import { restGet, restPost } from "../../../lib/server/rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireUser(request) {
  if (!hasServerSupabase()) {
    return { error: NextResponse.json({ error: "未配置" }, { status: 503 }) };
  }
  const token = readAccessToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: "请先登录" }, { status: 401 }) };
  }
  const user = await authGetUser(token);
  if (!user?.id) {
    return { error: NextResponse.json({ error: "登录失效" }, { status: 401 }) };
  }
  return { token, user };
}

function mapFeedback(r) {
  return {
    id: r.id,
    body: r.body || "",
    contact: r.contact || "",
    createdAt: r.created_at,
  };
}

/** GET /api/feedback — 我的反馈列表 */
export async function GET(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { token, user } = auth;
  try {
    const rows = await restGet(
      `/feedback?select=id,body,contact,created_at&user_id=eq.${user.id}&order=created_at.desc&limit=100`,
      { accessToken: token },
    );
    return NextResponse.json({
      items: (rows || []).map(mapFeedback),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "加载失败", items: [] },
      { status: 502 },
    );
  }
}

/** POST /api/feedback — 提交反馈 */
export async function POST(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { token, user } = auth;
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }
  const text = String(body?.body || "").trim();
  const contact = String(body?.contact || "").trim();
  if (!text) {
    return NextResponse.json({ error: "请填写反馈内容" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "反馈过长" }, { status: 400 });
  }
  try {
    const rows = await restPost(
      "/feedback",
      {
        id: randomUUID(),
        user_id: user.id,
        body: text,
        contact,
        created_at: new Date().toISOString(),
      },
      { accessToken: token },
    );
    const saved = Array.isArray(rows) ? rows[0] : rows;
    return NextResponse.json({ item: mapFeedback(saved || { body: text, contact }) });
  } catch (e) {
    return NextResponse.json({ error: e.message || "提交失败" }, { status: 502 });
  }
}
