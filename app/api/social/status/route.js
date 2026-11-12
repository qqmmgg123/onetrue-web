import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import { authGetUser, hasServerSupabase } from "../../../../lib/server/supabase";
import { restGet } from "../../../../lib/server/rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET ?noteId=&ownerId= → recommended / favorited / following */
export async function GET(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({
      recommended: false,
      favorited: false,
      following: false,
    });
  }
  const token = readAccessToken(request);
  const { searchParams } = new URL(request.url);
  const noteId = (searchParams.get("noteId") || "").trim();
  const ownerId = (searchParams.get("ownerId") || "").trim();
  if (!token) {
    return NextResponse.json({
      recommended: false,
      favorited: false,
      following: false,
    });
  }
  const user = await authGetUser(token);
  if (!user?.id) {
    return NextResponse.json({
      recommended: false,
      favorited: false,
      following: false,
    });
  }
  let recommended = false;
  let favorited = false;
  let following = false;
  if (noteId) {
    const r = await restGet(
      `/article_recommends?select=note_id&note_id=eq.${noteId}&user_id=eq.${user.id}&limit=1`,
      { accessToken: token },
    );
    recommended = Array.isArray(r) && r.length > 0;
    const f = await restGet(
      `/article_favorites?select=note_id&note_id=eq.${noteId}&user_id=eq.${user.id}&limit=1`,
      { accessToken: token },
    );
    favorited = Array.isArray(f) && f.length > 0;
  }
  if (ownerId && ownerId !== user.id) {
    const fl = await restGet(
      `/follows?select=follower_id&follower_id=eq.${user.id}&following_id=eq.${ownerId}&limit=1`,
      { accessToken: token },
    );
    following = Array.isArray(fl) && fl.length > 0;
  }
  return NextResponse.json({ recommended, favorited, following });
}
