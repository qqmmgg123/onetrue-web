"use client";

import { apiFetchArticle, apiFetchArticles } from "./client-api";
import { getSupabase, functionsBase, hasSupabase } from "./supabase";
import { hotScore } from "./format";

function asInt(v) {
  return typeof v === "number" ? v : parseInt(String(v ?? "0"), 10) || 0;
}

function articleFromRow(row) {
  const map = row || {};
  let listedAt = null;
  if (map.listed_at) {
    listedAt =
      map.listed_at instanceof Date
        ? map.listed_at.toISOString()
        : String(map.listed_at);
  }
  let viewCount = 0;
  let recommendCount = 0;
  let commentCount = 0;
  const stats = map.note_stats;
  const statsMap = Array.isArray(stats) ? stats[0] : stats;
  if (statsMap && typeof statsMap === "object") {
    viewCount = asInt(statsMap.view_count);
    recommendCount = asInt(statsMap.recommend_count);
    commentCount = asInt(statsMap.comment_count);
  }
  return {
    id: String(map.id || ""),
    title: String(map.title || ""),
    body: String(map.body || ""),
    format: String(map.format || "plain"),
    city: String(map.city || ""),
    listedAt,
    ownerId: String(map.owner_id || ""),
    viewCount,
    recommendCount,
    commentCount,
  };
}

const ARTICLE_SELECT =
  "id, title, body, format, city, listed_at, owner_id, note_stats(view_count, recommend_count, comment_count)";

/** 试点：走 Next /api/articles，浏览器不再直连 Supabase */
export async function fetchListedArticles({ city = "", ownerId = "" } = {}) {
  return apiFetchArticles({ city, ownerId });
}

export async function fetchArticleById(id) {
  return apiFetchArticle(id);
}

export async function incrementArticleView(noteId, viewerId = "") {
  if (!hasSupabase() || !noteId) return;
  const sb = getSupabase();
  try {
    const { data: note } = await sb
      .from("notes")
      .select("id, owner_id, deleted_at, kind, listing_status")
      .eq("id", noteId)
      .maybeSingle();
    if (!note || note.deleted_at) return;
    if (note.kind !== "article" || note.listing_status !== "listed") return;
    if (viewerId && note.owner_id === viewerId) return;
    const { data: stats } = await sb
      .from("note_stats")
      .select("view_count")
      .eq("note_id", noteId)
      .maybeSingle();
    if (!stats) {
      await sb.from("note_stats").upsert({
        note_id: noteId,
        view_count: 1,
        recommend_count: 0,
        comment_count: 0,
      });
      return;
    }
    await sb
      .from("note_stats")
      .update({ view_count: asInt(stats.view_count) + 1 })
      .eq("note_id", noteId);
  } catch (_) {
    /* ignore */
  }
}

export async function fetchProfiles(ids) {
  const list = [...new Set((ids || []).map((x) => String(x || "").trim()).filter(Boolean))];
  if (!list.length || !hasSupabase()) return {};
  const sb = getSupabase();
  const { data, error } = await sb
    .from("profiles")
    .select("id, nickname, avatar_url")
    .in("id", list);
  if (error) throw error;
  const out = {};
  for (const r of data || []) {
    out[r.id] = {
      id: r.id,
      nickname: r.nickname || "",
      avatarUrl: r.avatar_url || "",
      displayName:
        (r.nickname || "").trim() || `用户${String(r.id).slice(0, 4)}`,
    };
  }
  return out;
}

export async function ensureProfile(nickname = "") {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const uid = user?.id;
  if (!uid) throw new Error("请先登录");
  const { data: existing } = await sb
    .from("profiles")
    .select("id, nickname, avatar_url")
    .eq("id", uid)
    .maybeSingle();
  if (existing && (existing.nickname || "").trim()) {
    return {
      id: existing.id,
      nickname: existing.nickname,
      avatarUrl: existing.avatar_url || "",
      displayName: existing.nickname.trim(),
    };
  }
  const nick =
    nickname.trim() ||
    (existing?.nickname || "").trim() ||
    `用户${uid.slice(0, 4)}`;
  const { data, error } = await sb
    .from("profiles")
    .upsert({
      id: uid,
      nickname: nick,
      updated_at: new Date().toISOString(),
    })
    .select("id, nickname, avatar_url")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    nickname: data.nickname,
    avatarUrl: data.avatar_url || "",
    displayName: (data.nickname || "").trim() || nick,
  };
}

export async function upsertMyProfile({ nickname, avatarUrl } = {}) {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.id) throw new Error("请先登录");
  const payload = { id: user.id, updated_at: new Date().toISOString() };
  if (nickname != null) payload.nickname = nickname.trim();
  if (avatarUrl != null) payload.avatar_url = avatarUrl.trim();
  const { data, error } = await sb
    .from("profiles")
    .upsert(payload)
    .select("id, nickname, avatar_url")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    nickname: data.nickname,
    avatarUrl: data.avatar_url || "",
    displayName:
      (data.nickname || "").trim() || `用户${String(data.id).slice(0, 4)}`,
  };
}

export async function isFollowing(targetUserId) {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const tid = String(targetUserId || "").trim();
  if (!user?.id || !tid || user.id === tid) return false;
  const { data } = await sb
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", tid)
    .maybeSingle();
  return Boolean(data);
}

export async function toggleFollow(targetUserId) {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.id) throw new Error("请先登录");
  const tid = String(targetUserId || "").trim();
  if (!tid || tid === user.id) throw new Error("不能关注自己");
  const following = await isFollowing(tid);
  if (following) {
    await sb
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", tid);
    return false;
  }
  await sb.from("follows").upsert({
    follower_id: user.id,
    following_id: tid,
  });
  try {
    await sb.from("social_notifications").insert({
      user_id: tid,
      actor_id: user.id,
      kind: "follow",
      body: "关注了你",
    });
  } catch (_) {}
  return true;
}

export async function fetchFollowingArticles(limit = 100) {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.id) return [];
  const { data: follows } = await sb
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id)
    .order("created_at", { ascending: false });
  const ids = (follows || []).map((r) => r.following_id).filter(Boolean);
  if (!ids.length) return [];
  const { data, error } = await sb
    .from("notes")
    .select(ARTICLE_SELECT)
    .is("deleted_at", null)
    .eq("kind", "article")
    .eq("listing_status", "listed")
    .in("owner_id", ids)
    .order("listed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(articleFromRow);
}

export async function hasRecommended(noteId) {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.id || !noteId) return false;
  const { data } = await sb
    .from("article_recommends")
    .select("note_id")
    .eq("note_id", noteId)
    .eq("user_id", user.id)
    .maybeSingle();
  return Boolean(data);
}

export async function hasFavorited(noteId) {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.id || !noteId) return false;
  const { data } = await sb
    .from("article_favorites")
    .select("note_id")
    .eq("note_id", noteId)
    .eq("user_id", user.id)
    .maybeSingle();
  return Boolean(data);
}

async function bumpRecommend(noteId, delta) {
  const sb = getSupabase();
  const { data: row } = await sb
    .from("note_stats")
    .select("recommend_count")
    .eq("note_id", noteId)
    .maybeSingle();
  if (!row) {
    await sb.from("note_stats").upsert({
      note_id: noteId,
      view_count: 0,
      recommend_count: Math.max(0, delta),
      comment_count: 0,
    });
    return;
  }
  const next = Math.max(0, asInt(row.recommend_count) + delta);
  await sb
    .from("note_stats")
    .update({ recommend_count: next })
    .eq("note_id", noteId);
}

export async function toggleRecommend(noteId, ownerId) {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.id) throw new Error("请先登录");
  if (!noteId) throw new Error("无效文章");
  if (ownerId === user.id) throw new Error("不能推荐自己的文章");
  const existed = await hasRecommended(noteId);
  if (existed) {
    await sb
      .from("article_recommends")
      .delete()
      .eq("note_id", noteId)
      .eq("user_id", user.id);
    await bumpRecommend(noteId, -1);
  } else {
    await sb.from("article_recommends").upsert({
      note_id: noteId,
      user_id: user.id,
    });
    await bumpRecommend(noteId, 1);
    try {
      await sb.from("social_notifications").insert({
        user_id: ownerId,
        actor_id: user.id,
        kind: "recommend",
        note_id: noteId,
        body: "推荐了你的文章",
      });
    } catch (_) {}
  }
  const { data: stats } = await sb
    .from("note_stats")
    .select("recommend_count")
    .eq("note_id", noteId)
    .maybeSingle();
  return { recommended: !existed, count: asInt(stats?.recommend_count) };
}

export async function toggleFavorite(noteId) {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.id) throw new Error("请先登录");
  const existed = await hasFavorited(noteId);
  if (existed) {
    await sb
      .from("article_favorites")
      .delete()
      .eq("note_id", noteId)
      .eq("user_id", user.id);
    return false;
  }
  await sb.from("article_favorites").upsert({
    note_id: noteId,
    user_id: user.id,
  });
  return true;
}

export async function fetchMyFavorites(limit = 200) {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.id) return [];
  const { data: favRows } = await sb
    .from("article_favorites")
    .select("note_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  const ids = (favRows || []).map((r) => r.note_id).filter(Boolean);
  if (!ids.length) return [];
  const { data, error } = await sb
    .from("notes")
    .select(ARTICLE_SELECT)
    .in("id", ids)
    .is("deleted_at", null);
  if (error) throw error;
  const byId = {};
  for (const r of data || []) {
    const a = articleFromRow(r);
    if (a.id) byId[a.id] = a;
  }
  return ids.map((id) => byId[id]).filter(Boolean);
}

export async function listComments(noteId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("article_comments")
    .select(
      "id, note_id, author_id, parent_id, reply_to_user_id, body, created_at",
    )
    .eq("note_id", noteId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  const rows = data || [];
  const authorIds = new Set();
  for (const m of rows) {
    authorIds.add(m.author_id);
    if (m.reply_to_user_id) authorIds.add(m.reply_to_user_id);
  }
  const profiles = await fetchProfiles([...authorIds]);
  return rows.map((m) => {
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
}

async function bumpComment(noteId, delta) {
  const sb = getSupabase();
  const { data: row } = await sb
    .from("note_stats")
    .select("comment_count")
    .eq("note_id", noteId)
    .maybeSingle();
  if (!row) {
    await sb.from("note_stats").upsert({
      note_id: noteId,
      view_count: 0,
      recommend_count: 0,
      comment_count: Math.max(0, delta),
    });
    return;
  }
  const next = Math.max(0, asInt(row.comment_count) + delta);
  await sb
    .from("note_stats")
    .update({ comment_count: next })
    .eq("note_id", noteId);
}

export async function addComment({
  noteId,
  body,
  noteOwnerId,
  parentId,
  replyToUserId,
}) {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.id) throw new Error("请先登录");
  const text = String(body || "").trim();
  if (!text) throw new Error("评论不能为空");
  const payload = {
    note_id: noteId,
    author_id: user.id,
    body: text,
  };
  if (parentId) payload.parent_id = parentId;
  if (replyToUserId) payload.reply_to_user_id = replyToUserId;
  const { data, error } = await sb
    .from("article_comments")
    .insert(payload)
    .select(
      "id, note_id, author_id, parent_id, reply_to_user_id, body, created_at",
    )
    .single();
  if (error) throw error;
  await bumpComment(noteId, 1);
  const notifyUid = replyToUserId || noteOwnerId;
  if (notifyUid && notifyUid !== user.id) {
    try {
      await sb.from("social_notifications").insert({
        user_id: notifyUid,
        actor_id: user.id,
        kind: parentId ? "reply" : "comment",
        note_id: noteId,
        comment_id: data.id,
        body: text.length > 80 ? `${text.slice(0, 80)}…` : text,
      });
    } catch (_) {}
  }
  const me = (await fetchProfiles([user.id]))[user.id];
  return {
    id: data.id,
    noteId: data.note_id,
    authorId: user.id,
    parentId: data.parent_id || null,
    replyToUserId: data.reply_to_user_id || null,
    body: text,
    createdAt: data.created_at,
    authorNickname: me?.displayName || "",
    authorAvatarUrl: me?.avatarUrl || "",
    replyToNickname: "",
  };
}

export async function fetchNotifications(limit = 50) {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.id) return [];
  const { data, error } = await sb
    .from("social_notifications")
    .select(
      "id, user_id, actor_id, kind, note_id, comment_id, body, created_at, read_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const actorIds = (data || []).map((r) => r.actor_id).filter(Boolean);
  const profiles = await fetchProfiles(actorIds);
  return (data || []).map((r) => ({
    id: r.id,
    kind: r.kind,
    noteId: r.note_id,
    body: r.body || "",
    createdAt: r.created_at,
    readAt: r.read_at,
    actor: profiles[r.actor_id] || {
      displayName: "有人",
      avatarUrl: "",
      id: r.actor_id,
    },
  }));
}

export async function fetchMyNotes(limit = 100) {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.id) return [];
  const { data, error } = await sb
    .from("notes")
    .select(
      "id, title, body, format, kind, listing_status, updated_at, remind_at, schedule_at",
    )
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    title: r.title || "",
    body: r.body || "",
    format: r.format || "plain",
    kind: r.kind || "note",
    listingStatus: r.listing_status || "",
    updatedAt: r.updated_at,
    remindAt: r.remind_at,
    scheduleAt: r.schedule_at,
  }));
}

export async function chatWithAi(messages) {
  const sb = getSupabase();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session?.access_token) throw new Error("请先登录后再找 AI");
  const base = functionsBase();
  if (!base) throw new Error("未配置 Supabase");
  const res = await fetch(`${base}/llm-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `AI 请求失败 (${res.status})`);
  }
  const json = await res.json();
  const content =
    json?.reply ||
    json?.content ||
    json?.message ||
    json?.choices?.[0]?.message?.content ||
    "";
  if (!content) throw new Error("AI 无回复");
  return String(content);
}
