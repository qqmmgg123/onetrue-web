import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../../lib/server/session";
import {
  authGetUser,
  fetchArticleByIdServer,
  hasServerSupabase,
} from "../../../../../lib/server/supabase";
import { restGet, restPatch, restPost } from "../../../../../lib/server/rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/articles/:id/view
 * 对齐 App SyncService.incrementArticleView：上架文章 +1；作者自己不计。
 */
export async function POST(request, { params }) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "未配置" }, { status: 503 });
  }
  const id = String(params?.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  const token = readAccessToken(request) || "";
  let viewerId = "";
  if (token) {
    try {
      const user = await authGetUser(token);
      viewerId = user?.id || "";
    } catch (_) {}
  }

  try {
    const article = await fetchArticleByIdServer(id, token);
    if (!article) {
      return NextResponse.json({ error: "未找到或未上架" }, { status: 404 });
    }
    if (viewerId && article.ownerId && viewerId === article.ownerId) {
      return NextResponse.json({
        viewCount: article.viewCount || 0,
        skipped: true,
      });
    }

    const opts = token ? { accessToken: token } : {};
    const existing = await restGet(
      `/note_stats?select=view_count&note_id=eq.${encodeURIComponent(id)}&limit=1`,
      opts,
    );
    const row = Array.isArray(existing) ? existing[0] : null;
    let next = 1;
    if (!row) {
      await restPost(
        "/note_stats",
        {
          note_id: id,
          view_count: 1,
          recommend_count: 0,
          comment_count: 0,
        },
        { ...opts, prefer: "return=minimal" },
      );
    } else {
      const n = Number(row.view_count) || 0;
      next = n + 1;
      await restPatch(
        `/note_stats?note_id=eq.${encodeURIComponent(id)}`,
        { view_count: next },
        { ...opts, prefer: "return=minimal" },
      );
    }
    return NextResponse.json({ viewCount: next, skipped: false });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "计数失败", viewCount: null },
      { status: 502 },
    );
  }
}
