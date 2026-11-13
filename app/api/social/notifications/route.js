import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import {
  authGetUser,
  fetchProfileServer,
  hasServerSupabase,
} from "../../../../lib/server/supabase";
import { restGet } from "../../../../lib/server/rest";

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
    `/social_notifications?select=id,user_id,actor_id,kind,note_id,comment_id,body,created_at,read_at&user_id=eq.${user.id}&order=created_at.desc&limit=50`,
    { accessToken: token },
  );
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
