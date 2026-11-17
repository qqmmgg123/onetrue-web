import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { readAccessToken } from "../../../lib/server/session";
import { authGetUser, hasServerSupabase } from "../../../lib/server/supabase";
import { restGet, restPost } from "../../../lib/server/rest";
import { resolveNoteTitleForSave } from "../../../lib/format";
import {
  NOTE_SELECT,
  mapNote,
  recurFieldsFromBody,
} from "../../../lib/server/note-map";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get("limit") || 40);
    const offsetRaw = Number(url.searchParams.get("offset") || 0);
    const kind = String(url.searchParams.get("kind") || "").trim();
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 40));
    const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);
    const params = [
      `select=${NOTE_SELECT}`,
      `owner_id=eq.${user.id}`,
      "deleted_at=is.null",
      "order=updated_at.desc",
      `limit=${limit}`,
      `offset=${offset}`,
    ];
    if (kind) params.push(`kind=eq.${encodeURIComponent(kind)}`);
    const rows = await restGet(`/notes?${params.join("&")}`, {
      accessToken: token,
    });
    const notes = (rows || []).map(mapNote);
    return NextResponse.json({
      notes,
      limit,
      offset,
      hasMore: notes.length >= limit,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message, notes: [], hasMore: false },
      { status: 502 },
    );
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
  const text = String(body.body || "");
  const format = String(body.format || "quill");
  const title = resolveNoteTitleForSave({
    kind,
    title: body.title,
    body: text,
    format,
  });
  const listingStatus =
    body.listingStatus === "listed" || body.list === true
      ? "listed"
      : "draft";
  const city = String(body.city || "").trim();
  const now = new Date().toISOString();
  const id = body.id || randomUUID();
  let scheduleAt = body.scheduleAt
    ? new Date(body.scheduleAt).toISOString()
    : null;
  let remindAt = body.remindAt ? new Date(body.remindAt).toISOString() : null;

  if (!text.trim() && !title) {
    return NextResponse.json({ error: "请填写标题或正文" }, { status: 400 });
  }
  if ((kind === "schedule" || kind === "article") && !String(body.title || "").trim()) {
    return NextResponse.json(
      { error: kind === "schedule" ? "日常必须填写标题" : "文章必须填写标题" },
      { status: 400 },
    );
  }

  const recur = recurFieldsFromBody(body, { kind });
  if (kind === "schedule") {
    if (!scheduleAt) scheduleAt = now;
    if (recur.remind_offset_min < 0) {
      remindAt = null;
    } else if (body.remindAt == null || body.remindAt === "") {
      const ms =
        new Date(scheduleAt).getTime() - recur.remind_offset_min * 60000;
      remindAt = new Date(ms).toISOString();
    }
  } else if (kind === "memo") {
    scheduleAt = null;
    // 备忘：不提醒则 remindAt 为空
    if (body.noRemind === true || body.remindOffsetMin === -1) {
      remindAt = null;
    }
  } else {
    scheduleAt = null;
    remindAt = null;
  }

  const row = {
    id,
    owner_id: user.id,
    kind,
    title,
    body: text,
    format,
    listing_status: kind === "article" ? listingStatus : "draft",
    city,
    updated_at: now,
    listed_at:
      kind === "article" && listingStatus === "listed" ? now : null,
    schedule_at: scheduleAt,
    remind_at: remindAt,
    ...recur,
    deleted_at: null,
  };

  try {
    const rows = await restPost("/notes", row, { accessToken: token });
    const saved = Array.isArray(rows) ? rows[0] : rows;
    if (row.listing_status === "listed") {
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
