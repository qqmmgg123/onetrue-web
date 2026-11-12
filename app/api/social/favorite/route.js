import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import {
  articleFromRow,
  ARTICLE_SELECT,
  authGetUser,
  hasServerSupabase,
} from "../../../../lib/server/supabase";
import { restDelete, restGet, restPost } from "../../../../lib/server/rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ articles: [] }, { status: 503 });
  }
  const token = readAccessToken(request);
  if (!token) return NextResponse.json({ articles: [] });
  const user = await authGetUser(token);
  if (!user?.id) return NextResponse.json({ articles: [] });
  const favs = await restGet(
    `/article_favorites?select=note_id,created_at&user_id=eq.${user.id}&order=created_at.desc&limit=200`,
    { accessToken: token },
  );
  const ids = (favs || []).map((r) => r.note_id).filter(Boolean);
  if (!ids.length) return NextResponse.json({ articles: [] });
  const rows = await restGet(
    `/notes?select=${encodeURIComponent(ARTICLE_SELECT)}&id=in.(${ids.join(",")})&deleted_at=is.null`,
    { accessToken: token },
  );
  const byId = {};
  for (const r of rows || []) {
    const a = articleFromRow(r);
    if (a.id) byId[a.id] = a;
  }
  return NextResponse.json({
    articles: ids.map((id) => byId[id]).filter(Boolean),
  });
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
  if (!noteId) return NextResponse.json({ error: "无效文章" }, { status: 400 });
  const existed = await restGet(
    `/article_favorites?select=note_id&note_id=eq.${noteId}&user_id=eq.${user.id}&limit=1`,
    { accessToken: token },
  );
  if (Array.isArray(existed) && existed.length) {
    await restDelete(
      `/article_favorites?note_id=eq.${noteId}&user_id=eq.${user.id}`,
      { accessToken: token },
    );
    return NextResponse.json({ favorited: false });
  }
  await restPost(
    "/article_favorites",
    { note_id: noteId, user_id: user.id },
    { accessToken: token, prefer: "return=minimal" },
  );
  return NextResponse.json({ favorited: true });
}
