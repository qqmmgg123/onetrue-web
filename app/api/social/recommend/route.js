import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import {
  asInt,
  authGetUser,
  hasServerSupabase,
} from "../../../../lib/server/supabase";
import { restDelete, restGet, restPost, restPatch } from "../../../../lib/server/rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function bump(noteId, token, delta) {
  const rows = await restGet(
    `/note_stats?select=recommend_count&note_id=eq.${noteId}&limit=1`,
    { accessToken: token },
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) {
    await restPost(
      "/note_stats",
      {
        note_id: noteId,
        view_count: 0,
        recommend_count: Math.max(0, delta),
        comment_count: 0,
      },
      { accessToken: token, prefer: "return=minimal" },
    );
    return Math.max(0, delta);
  }
  const next = Math.max(0, asInt(row.recommend_count) + delta);
  await restPatch(
    `/note_stats?note_id=eq.${noteId}`,
    { recommend_count: next },
    { accessToken: token, prefer: "return=minimal" },
  );
  return next;
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
  const noteId = String(body.noteId || "").trim();
  const ownerId = String(body.ownerId || "").trim();
  if (!noteId) return NextResponse.json({ error: "无效文章" }, { status: 400 });
  if (ownerId && ownerId === user.id) {
    return NextResponse.json({ error: "不能推荐自己的文章" }, { status: 400 });
  }
  const existed = await restGet(
    `/article_recommends?select=note_id&note_id=eq.${noteId}&user_id=eq.${user.id}&limit=1`,
    { accessToken: token },
  );
  const has = Array.isArray(existed) && existed.length > 0;
  if (has) {
    await restDelete(
      `/article_recommends?note_id=eq.${noteId}&user_id=eq.${user.id}`,
      { accessToken: token },
    );
    const count = await bump(noteId, token, -1);
    return NextResponse.json({ recommended: false, count });
  }
  await restPost(
    "/article_recommends",
    { note_id: noteId, user_id: user.id },
    { accessToken: token, prefer: "return=minimal" },
  );
  const count = await bump(noteId, token, 1);
  if (ownerId) {
    try {
      await restPost(
        "/social_notifications",
        {
          user_id: ownerId,
          actor_id: user.id,
          kind: "recommend",
          note_id: noteId,
          body: "推荐了你的文章",
        },
        { accessToken: token, prefer: "return=minimal" },
      );
    } catch (_) {}
  }
  return NextResponse.json({ recommended: true, count });
}
