import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import { authGetUser, hasServerSupabase } from "../../../../lib/server/supabase";
import { restDelete, restGet, restPost } from "../../../../lib/server/rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "未配置" }, { status: 503 });
  }
  const token = readAccessToken(request);
  if (!token) return NextResponse.json({ following: false });
  const { searchParams } = new URL(request.url);
  const target = (searchParams.get("userId") || "").trim();
  const user = await authGetUser(token);
  if (!user?.id || !target || user.id === target) {
    return NextResponse.json({ following: false });
  }
  const rows = await restGet(
    `/follows?select=follower_id&follower_id=eq.${user.id}&following_id=eq.${target}&limit=1`,
    { accessToken: token },
  );
  return NextResponse.json({ following: Array.isArray(rows) && rows.length > 0 });
}

export async function POST(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "未配置" }, { status: 503 });
  }
  const token = readAccessToken(request);
  if (!token) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const user = await authGetUser(token);
  if (!user?.id) return NextResponse.json({ error: "登录失效" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const target = String(body.userId || "").trim();
  if (!target || target === user.id) {
    return NextResponse.json({ error: "不能留意自己" }, { status: 400 });
  }
  const existing = await restGet(
    `/follows?select=follower_id&follower_id=eq.${user.id}&following_id=eq.${target}&limit=1`,
    { accessToken: token },
  );
  if (Array.isArray(existing) && existing.length) {
    await restDelete(
      `/follows?follower_id=eq.${user.id}&following_id=eq.${target}`,
      { accessToken: token },
    );
    return NextResponse.json({ following: false });
  }
  await restPost(
    "/follows",
    { follower_id: user.id, following_id: target },
    { accessToken: token, prefer: "return=minimal" },
  );
  try {
    await restPost(
      "/social_notifications",
      {
        user_id: target,
        actor_id: user.id,
        kind: "follow",
        body: "留意了你",
      },
      { accessToken: token, prefer: "return=minimal" },
    );
  } catch (_) {}
  return NextResponse.json({ following: true });
}
