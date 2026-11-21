import { NextResponse } from "next/server";
import { readAccessToken } from "../../../lib/server/session";
import { hasServerSupabase } from "../../../lib/server/supabase";
import { restGet } from "../../../lib/server/rest";
import { NOTE_SELECT, mapNote } from "../../../lib/server/note-map";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 公开：已推荐谏言列表（备忘侧栏） */
export async function GET(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "未配置", notes: [] }, { status: 503 });
  }
  const token = readAccessToken(request) || "";
  try {
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get("limit") || 40);
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 40));
    const params = [
      `select=${NOTE_SELECT}`,
      "deleted_at=is.null",
      "kind=eq.admonition",
      "listing_status=eq.listed",
      "order=listed_at.desc,updated_at.desc",
      `limit=${limit}`,
    ];
    const rows = await restGet(`/notes?${params.join("&")}`, {
      accessToken: token,
    });
    const notes = (rows || []).map(mapNote);
    return NextResponse.json({ notes });
  } catch (e) {
    return NextResponse.json(
      { error: e.message, notes: [] },
      { status: 502 },
    );
  }
}
