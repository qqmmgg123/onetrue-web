import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { readAccessToken } from "../../../lib/server/session";
import { authGetUser, hasServerSupabase } from "../../../lib/server/supabase";
import { restGet, restPost } from "../../../lib/server/rest";
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
    const rows = await restGet(
      `/notes?select=${NOTE_SELECT}&owner_id=eq.${user.id}&deleted_at=is.null&order=updated_at.desc&limit=200`,
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
  let scheduleAt = body.scheduleAt
    ? new Date(body.scheduleAt).toISOString()
    : null;
  let remindAt = body.remindAt ? new Date(body.remindAt).toISOString() : null;

  if (!text.trim() && !title) {
    return NextResponse.json({ error: "请填写标题或正文" }, { status: 400 });
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
    title:
      title ||
      (kind === "article"
        ? "无标题文章"
        : kind === "memo"
          ? "备忘"
          : kind === "schedule"
            ? "日程"
            : "随笔"),
    body: text,
    format: body.format || "quill",
    listing_status: kind === "article" ? listingStatus : "draft",
    city,
    updated_at: now,
    created_at: now,
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
