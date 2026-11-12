import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import {
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
    const article = await fetchArticleByIdServer(id, readAccessToken(request));
    if (!article) {
      return NextResponse.json({ error: "未找到或未上架" }, { status: 404 });
    }
    return NextResponse.json({ article });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "拉取失败" },
      { status: 502 },
    );
  }
}
