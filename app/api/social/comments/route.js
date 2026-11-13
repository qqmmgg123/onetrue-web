import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import {
  asInt,
  authGetUser,
  fetchProfileServer,
  hasServerSupabase,
} from "../../../../lib/server/supabase";
import { restGet, restPost, restPatch } from "../../../../lib/server/rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ comments: [] }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const noteId = (searchParams.get("noteId") || "").trim();
  if (!noteId) return NextResponse.json({ comments: [] });
  const token = readAccessToken(request);
  const rows = await restGet(
    `/article_comments?select=id,note_id,author_id,parent_id,reply_to_user_id,body,created_at&note_id=eq.${noteId}&deleted_at=is.null&order=created_at.asc&limit=500`,
    { accessToken: token },
  );
  const authorIds = new Set();
  for (const m of rows || []) {
    authorIds.add(m.author_id);
    if (m.reply_to_user_id) authorIds.add(m.reply_to_user_id);
  }
  const profiles = {};
  await Promise.all(
    [...authorIds].map(async (id) => {
      try {
        profiles[id] = await fetchProfileServer(id, token);
      } catch (_) {}
    }),
  );
  const comments = (rows || []).map((m) => {
    const ap = profiles[m.author_id];
    const rp = m.reply_to_user_id ? profiles[m.reply_to_user_id] : null;
    return {
      id: m.id,
      noteId: m.note_id,
      authorId: m.author_id,
      parentId: m.parent_id || null,
      replyToUserId: m.reply_to_user_id || null,
      body: m.body || "",
      createdAt: m.created_at,
      authorNickname: ap?.displayName || "",
      authorAvatarUrl: ap?.avatarUrl || "",
      replyToNickname: rp?.displayName || "",
    };
  });
  return NextResponse.json({ comments });
}

export async function POST(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "未配置" }, { status: 503 });
  }
  const token = readAccessToken(request);
  if (!token) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const user = await authGetUser(token);
  if (!user?.id) return NextResponse.json({ error: "登录失效" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const noteId = String(body.noteId || "").trim();
  const text = String(body.body || "").trim();
  const noteOwnerId = String(body.noteOwnerId || "").trim();
  const parentId = String(body.parentId || "").trim();
  const replyToUserId = String(body.replyToUserId || "").trim();
  if (!noteId || !text) {
    return NextResponse.json({ error: "评点不能为空" }, { status: 400 });
  }
  const payload = {
    note_id: noteId,
    author_id: user.id,
    body: text,
  };
  if (parentId) payload.parent_id = parentId;
  if (replyToUserId) payload.reply_to_user_id = replyToUserId;

  const rows = await restPost("/article_comments", payload, {
    accessToken: token,
  });
  const row = Array.isArray(rows) ? rows[0] : rows;

  // bump comment_count
  try {
    const stats = await restGet(
      `/note_stats?select=comment_count&note_id=eq.${noteId}&limit=1`,
      { accessToken: token },
    );
    const s = Array.isArray(stats) ? stats[0] : stats;
    if (!s) {
      await restPost(
        "/note_stats",
        {
          note_id: noteId,
          view_count: 0,
          recommend_count: 0,
          comment_count: 1,
        },
        { accessToken: token, prefer: "return=minimal" },
      );
    } else {
      await restPatch(
        `/note_stats?note_id=eq.${noteId}`,
        { comment_count: asInt(s.comment_count) + 1 },
        { accessToken: token, prefer: "return=minimal" },
      );
    }
  } catch (_) {}

  const notifyUid = replyToUserId || noteOwnerId;
  if (notifyUid && notifyUid !== user.id) {
    try {
      await restPost(
        "/social_notifications",
        {
          user_id: notifyUid,
          actor_id: user.id,
          kind: parentId ? "reply" : "comment",
          note_id: noteId,
          comment_id: row?.id,
          body: text.length > 80 ? `${text.slice(0, 80)}…` : text,
        },
        { accessToken: token, prefer: "return=minimal" },
      );
    } catch (_) {}
  }

  const me = await fetchProfileServer(user.id, token);
  let replyToNickname = "";
  if (replyToUserId) {
    try {
      const rp = await fetchProfileServer(replyToUserId, token);
      replyToNickname = rp?.displayName || "";
    } catch (_) {}
  }
  return NextResponse.json({
    comment: {
      id: row?.id,
      noteId,
      authorId: user.id,
      parentId: parentId || null,
      replyToUserId: replyToUserId || null,
      body: text,
      createdAt: row?.created_at || new Date().toISOString(),
      authorNickname: me?.displayName || "",
      authorAvatarUrl: me?.avatarUrl || "",
      replyToNickname,
    },
  });
}
