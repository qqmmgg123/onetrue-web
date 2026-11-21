import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import {
  articleAvailabilityServer,
  articleUnavailableMessage,
  fetchArticleByIdServer,
  hasServerSupabase,
} from "../../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/articles/:id */
export async function GET(request, { params }) {
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "服务端未配置 Supabase" },
      { status: 503 },
    );
  }

  const id = params?.id || "";
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  try {
    const token = readAccessToken(request);
    const article = await fetchArticleByIdServer(id, token);
    if (article) {
      return NextResponse.json({ article, status: "ok" });
    }
    const status = await articleAvailabilityServer(id, token);
    return NextResponse.json(
      {
        article: null,
        status,
        error: articleUnavailableMessage(status),
      },
      { status: 404 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "拉取失败" },
      { status: 502 },
    );
  }
}
