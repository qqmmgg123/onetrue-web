import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { readAccessToken } from "../../../lib/server/session";
import { authGetUser, hasServerSupabase } from "../../../lib/server/supabase";
import { restGet, restPost } from "../../../lib/server/rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function mapNote(r) {
  return {
    id: r.id,
    title: r.title || "",
    body: r.body || "",
    format: r.format || "plain",
    kind: r.kind || "note",
    listingStatus: r.listing_status || "draft",
    city: r.city || "",
    updatedAt: r.updated_at,
    createdAt: r.created_at,
    listedAt: r.listed_at,
    remindAt: r.remind_at,
    scheduleAt: r.schedule_at,
    ownerId: r.owner_id,
  };
}

export async function GET(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "未配置" }, { status: 503 });
  }
  const token = readAccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const user = await authGetUser(token);
  if (!user?.id) {
    return NextResponse.json({ error: "登录失效" }, { status: 401 });
  }
  try {
    const rows = await restGet(
      `/notes?select=id,title,body,format,kind,listing_status,city,updated_at,created_at,listed_at,remind_at,schedule_at,owner_id&owner_id=eq.${user.id}&deleted_at=is.null&order=updated_at.desc&limit=200`,
      { accessToken: token },
    );
    return NextResponse.json({ notes: (rows || []).map(mapNote) });
  } catch (e) {
    return NextResponse.json({ error: e.message, notes: [] }, { status: 502 });
  }
}

/** 新建笔记；kind=note|memo|schedule|article；可 listingStatus=listed 上架 */
export async function POST(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "未配置" }, { status: 503 });
  }
  const token = readAccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const user = await authGetUser(token);
  if (!user?.id) {
    return NextResponse.json({ error: "登录失效" }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const kind = String(body.kind || "note").trim() || "note";
  const title = String(body.title || "").trim();
  const text = String(body.body || "");
  const listingStatus =
    body.listingStatus === "listed" || body.list === true
      ? "listed"
      : "draft";
  const city = String(body.city || "").trim();
  const now = new Date().toISOString();
  const id = body.id || randomUUID();

  if (!text.trim() && !title) {
    return NextResponse.json({ error: "请填写标题或正文" }, { status: 400 });
  }

  const row = {
    id,
    owner_id: user.id,
    kind,
    title:
      title ||
      (kind === "article" ? "无标题文章" : kind === "memo" ? "备忘" : "随笔"),
    body: text,
    format: body.format || "plain",
    listing_status: listingStatus,
    city,
    updated_at: now,
    created_at: now,
    listed_at: listingStatus === "listed" ? now : null,
    deleted_at: null,
  };

  try {
    const rows = await restPost("/notes", row, { accessToken: token });
    const saved = Array.isArray(rows) ? rows[0] : rows;
    // 上架文章时确保 note_stats 行存在
    if (listingStatus === "listed") {
      try {
        await restPost(
          "/note_stats?on_conflict=note_id",
          {
            note_id: id,
            view_count: 0,
            recommend_count: 0,
            comment_count: 0,
          },
          {
            accessToken: token,
            prefer: "resolution=merge-duplicates,return=minimal",
          },
        );
      } catch (_) {}
    }
    return NextResponse.json({ note: mapNote(saved || row) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
