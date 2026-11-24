"use client";

/**
 * Web 业务 API —— 全部经本站网关，不直连 Supabase。
 */
import {
  apiAddComment,
  apiChat,
  apiConfirmAi,
  apiNoteDraftAi,
  apiFetchFeedback,
  apiSubmitFeedback,
  apiFetchReads,
  apiUpsertRead,
  apiDeleteRead,
  apiVisionUnderstand,
  apiCreateNote,
  apiDeleteNote,
  apiFetchNote,
  apiUpdateNote,
  apiFavorites,
  apiFetchArticle,
  apiFetchArticles,
  apiIncrementArticleView,
  apiFetchAdmonitions,
  apiFetchNotes,
  apiFetchProfiles,
  apiFollowingFeed,
  apiListComments,
  apiNotifications,
  apiSocialStatus,
  apiToggleFavorite,
  apiToggleFollow,
  apiToggleRecommend,
  apiUpdateProfile,
  apiUploadAvatar,
} from "./client-api";

export async function fetchListedArticles(opts) {
  return apiFetchArticles(opts);
}

export async function fetchArticleById(id) {
  return apiFetchArticle(id);
}

export async function incrementArticleView(noteId) {
  return apiIncrementArticleView(noteId);
}

export async function fetchProfiles(ids) {
  return apiFetchProfiles(ids);
}

export async function upsertMyProfile(opts) {
  return apiUpdateProfile(opts);
}

export async function uploadMyAvatar(file) {
  return apiUploadAvatar(file);
}

export async function isFollowing() {
  return false;
}

export async function toggleFollow(targetUserId) {
  const r = await apiToggleFollow(targetUserId);
  return Boolean(r?.following);
}

export async function fetchFollowingArticles() {
  return apiFollowingFeed();
}

export async function hasRecommended() {
  return false;
}

export async function hasFavorited() {
  return false;
}

export async function toggleRecommend(noteId, ownerId) {
  return apiToggleRecommend({ noteId, ownerId });
}

export async function toggleFavorite(noteId) {
  const r = await apiToggleFavorite(noteId);
  return Boolean(r?.favorited);
}

export async function fetchMyFavorites() {
  return apiFavorites();
}

export async function listComments(noteId) {
  return apiListComments(noteId);
}

export async function addComment(opts) {
  return apiAddComment(opts);
}

export async function fetchNotifications() {
  return apiNotifications();
}

export async function fetchMyNotes(opts) {
  const data = await apiFetchNotes(opts);
  // 兼容旧调用：直接返回数组；分页调用传对象
  if (opts && (opts.limit != null || opts.offset != null || opts.kind)) {
    return data;
  }
  return data.notes || [];
}

export async function fetchAdmonitions(opts) {
  return apiFetchAdmonitions(opts);
}

export async function createNote(opts) {
  return apiCreateNote(opts);
}

export async function updateNote(id, opts) {
  return apiUpdateNote(id, opts);
}

export async function deleteNote(id) {
  return apiDeleteNote(id);
}

export async function fetchMyNote(id) {
  return apiFetchNote(id);
}

export async function fetchSocialStatus(opts) {
  return apiSocialStatus(opts);
}

export async function chatWithAi(messages) {
  return apiChat(messages);
}

export async function confirmAiAction(pending) {
  return apiConfirmAi(pending);
}

export async function noteDraftAi(payload) {
  return apiNoteDraftAi(payload);
}

export async function fetchMyFeedback() {
  return apiFetchFeedback();
}

export async function submitFeedback(payload) {
  return apiSubmitFeedback(payload);
}

export async function fetchMyReads() {
  return apiFetchReads();
}

export async function upsertMyRead(article) {
  return apiUpsertRead(article);
}

export async function removeMyRead(noteId) {
  return apiDeleteRead(noteId);
}

export async function visionUnderstand(payload) {
  return apiVisionUnderstand(payload);
}
