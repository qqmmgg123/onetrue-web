import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import {
  authGetUser,
  fetchProfileServer,
  hasServerSupabase,
} from "../../../../lib/server/supabase";
import { restDelete, restGet } from "../../../../lib/server/rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ notifications: [] }, { status: 503 });
  }
  const token = readAccessToken(request);
  if (!token) return NextResponse.json({ notifications: [] });
  const user = await authGetUser(token);
  if (!user?.id) return NextResponse.json({ notifications: [] });
  const rows = await restGet(
    `/social_notifications?select=id,user_id,actor_id,kind,note_id,comment_id,body,created_at,read_at&user_id=eq.${user.id}&order=created_at.desc&limit=100`,
    { accessToken: token },
  );
  const noteIds = [
    ...new Set((rows || []).map((r) => r.note_id).filter(Boolean)),
  ];
  const titles = {};
  if (noteIds.length) {
    try {
      const notes = await restGet(
        `/notes?select=id,title&id=in.(${noteIds.join(",")})`,
        { accessToken: token },
      );
      for (const n of notes || []) {
        if (n?.id) titles[n.id] = n.title || "";
      }
    } catch (_) {}
  }
  const out = [];
  for (const r of rows || []) {
    let actor = null;
    try {
      actor = await fetchProfileServer(r.actor_id, token);
    } catch (_) {}
    out.push({
      id: r.id,
      kind: r.kind,
      noteId: r.note_id,
      commentId: r.comment_id || null,
      body: r.body || "",
      noteTitle: titles[r.note_id] || "",
      createdAt: r.created_at,
      readAt: r.read_at,
      actor: actor || {
        id: r.actor_id,
        displayName: "有人",
        avatarUrl: "",
      },
    });
  }
  return NextResponse.json({ notifications: out });
}

/** DELETE /api/social/notifications?id= — 移除一条提醒（不删评点/文章） */
export async function DELETE(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "未配置" }, { status: 503 });
  }
  const token = readAccessToken(request);
  if (!token) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const user = await authGetUser(token);
  if (!user?.id) return NextResponse.json({ error: "登录失效" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  let id = (searchParams.get("id") || "").trim();
  if (!id) {
    try {
      const body = await request.json();
      id = String(body?.id || "").trim();
    } catch (_) {}
  }
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }
  try {
    await restDelete(
      `/social_notifications?id=eq.${encodeURIComponent(id)}&user_id=eq.${user.id}`,
      { accessToken: token, prefer: "return=minimal" },
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "移除失败" },
      { status: 502 },
    );
  }
}
