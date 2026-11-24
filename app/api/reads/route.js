import { NextResponse } from "next/server";
import { readAccessToken } from "../../../lib/server/session";
import { authGetUser, hasServerSupabase } from "../../../lib/server/supabase";
import { restDelete, restGet, restPost } from "../../../lib/server/rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT_FULL =
  "note_id,title,body,format,city,cover_url,owner_id,last_read_at,notes(cover_url)";
const SELECT_FALLBACK =
  "note_id,title,body,format,city,owner_id,last_read_at,notes(cover_url)";

function mapRow(r) {
  const snap = String(r.cover_url || "").trim();
  const noteCover = String(r.notes?.cover_url || "").trim();
  return {
    id: r.note_id,
    title: r.title || "",
    body: r.body || "",
    format: r.format || "plain",
    city: r.city || "",
    coverUrl: snap || noteCover,
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
    let rows;
    try {
      rows = await restGet(
        `/user_article_reads?select=${encodeURIComponent(SELECT_FULL)}&user_id=eq.${user.id}&order=last_read_at.desc&limit=100`,
        { accessToken: token },
      );
    } catch (_) {
      rows = await restGet(
        `/user_article_reads?select=${encodeURIComponent(SELECT_FALLBACK)}&user_id=eq.${user.id}&order=last_read_at.desc&limit=100`,
        { accessToken: token },
      );
    }
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
  const coverUrl = String(body?.coverUrl || body?.cover_url || "").trim();
  const row = {
    user_id: user.id,
    note_id: noteId,
    title: String(body?.title || "").trim(),
    body: String(body?.body || ""),
    format: String(body?.format || "quill"),
    city: String(body?.city || "").trim(),
    cover_url: coverUrl,
    owner_id: body?.ownerId || body?.owner_id || null,
    last_read_at: body?.lastReadAt || now,
  };
  try {
    let rows;
    try {
      rows = await restPost(
        "/user_article_reads?on_conflict=user_id,note_id",
        row,
        {
          accessToken: token,
          prefer: "resolution=merge-duplicates,return=representation",
        },
      );
    } catch (_) {
      const { cover_url: _c, ...withoutCover } = row;
      rows = await restPost(
        "/user_article_reads?on_conflict=user_id,note_id",
        withoutCover,
        {
          accessToken: token,
          prefer: "resolution=merge-duplicates,return=representation",
        },
      );
    }
    const saved = Array.isArray(rows) ? rows[0] : rows;
    return NextResponse.json({
      item: mapRow(saved || { ...row, notes: { cover_url: coverUrl } }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "写入失败" },
      { status: 502 },
    );
  }
}

/** DELETE /api/reads?noteId= — 从近期阅读移除（不删文章） */
export async function DELETE(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { token, user } = auth;
  const { searchParams } = new URL(request.url);
  let noteId = (searchParams.get("noteId") || searchParams.get("id") || "").trim();
  if (!noteId) {
    try {
      const body = await request.json();
      noteId = String(body?.noteId || body?.id || "").trim();
    } catch (_) {}
  }
  if (!noteId) {
    return NextResponse.json({ error: "缺少文章 id" }, { status: 400 });
  }
  try {
    await restDelete(
      `/user_article_reads?user_id=eq.${user.id}&note_id=eq.${noteId}`,
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
