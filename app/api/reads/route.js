import { NextResponse } from "next/server";
import { readAccessToken } from "../../../lib/server/session";
import { authGetUser, hasServerSupabase } from "../../../lib/server/supabase";
import { restGet, restPost } from "../../../lib/server/rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT =
  "note_id,title,body,format,city,owner_id,last_read_at";

function mapRow(r) {
  return {
    id: r.note_id,
    title: r.title || "",
    body: r.body || "",
    format: r.format || "plain",
    city: r.city || "",
    ownerId: r.owner_id || "",
    lastReadAt: r.last_read_at,
  };
}

async function requireUser(request) {
  if (!hasServerSupabase()) {
    return { error: NextResponse.json({ error: "未配置" }, { status: 503 }) };
  }
  const token = readAccessToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: "请先登录" }, { status: 401 }) };
  }
  const user = await authGetUser(token);
  if (!user?.id) {
    return { error: NextResponse.json({ error: "登录失效" }, { status: 401 }) };
  }
  return { token, user };
}

/** GET /api/reads — 当前登录用户云端近期阅读（游客勿调） */
export async function GET(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { token, user } = auth;
  try {
    const rows = await restGet(
      `/user_article_reads?select=${SELECT}&user_id=eq.${user.id}&order=last_read_at.desc&limit=100`,
      { accessToken: token },
    );
    return NextResponse.json({ items: (rows || []).map(mapRow) });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "加载失败", items: [] },
      { status: 502 },
    );
  }
}

/** POST /api/reads — 登录用户写入一条云端阅读（游客勿调） */
export async function POST(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { token, user } = auth;
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }
  const noteId = String(body?.id || body?.noteId || "").trim();
  if (!noteId) {
    return NextResponse.json({ error: "缺少文章 id" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const row = {
    user_id: user.id,
    note_id: noteId,
    title: String(body?.title || "").trim(),
    body: String(body?.body || ""),
    format: String(body?.format || "quill"),
    city: String(body?.city || "").trim(),
    owner_id: body?.ownerId || body?.owner_id || null,
    last_read_at: body?.lastReadAt || now,
  };
  try {
    const rows = await restPost(
      "/user_article_reads?on_conflict=user_id,note_id",
      row,
      {
        accessToken: token,
        prefer: "resolution=merge-duplicates,return=representation",
      },
    );
    const saved = Array.isArray(rows) ? rows[0] : rows;
    return NextResponse.json({ item: mapRow(saved || row) });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "写入失败" },
      { status: 502 },
    );
  }
}
