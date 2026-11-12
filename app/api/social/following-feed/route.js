import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import {
  articleFromRow,
  ARTICLE_SELECT,
  authGetUser,
  hasServerSupabase,
} from "../../../../lib/server/supabase";
import { restGet } from "../../../../lib/server/rest";

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
  const follows = await restGet(
    `/follows?select=following_id&follower_id=eq.${user.id}&order=created_at.desc`,
    { accessToken: token },
  );
  const ids = (follows || []).map((r) => r.following_id).filter(Boolean);
  if (!ids.length) return NextResponse.json({ articles: [] });
  const rows = await restGet(
    `/notes?select=${encodeURIComponent(ARTICLE_SELECT)}&deleted_at=is.null&kind=eq.article&listing_status=eq.listed&owner_id=in.(${ids.join(",")})&order=listed_at.desc&limit=100`,
    { accessToken: token },
  );
  return NextResponse.json({
    articles: (rows || []).map(articleFromRow),
  });
}
