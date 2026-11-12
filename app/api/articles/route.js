import { NextResponse } from "next/server";
import { readAccessToken } from "../../../lib/server/session";
import {
  fetchListedArticlesServer,
  hasServerSupabase,
} from "../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/articles?city=&ownerId= */
export async function GET(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "服务端未配置 Supabase", articles: [] },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") || "";
  const ownerId = searchParams.get("ownerId") || "";
  const accessToken = readAccessToken(request);

  try {
    const articles = await fetchListedArticlesServer({
      city,
      ownerId,
      accessToken,
    });
    return NextResponse.json({ articles });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "拉取文章失败", articles: [] },
      { status: 502 },
    );
  }
}
