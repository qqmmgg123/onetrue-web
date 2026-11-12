"use client";

/**
 * Web 业务 API —— 全部经本站网关，不直连 Supabase。
 */
import {
  apiAddComment,
  apiChat,
  apiCreateNote,
  apiFavorites,
  apiFetchArticle,
  apiFetchArticles,
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

export async function incrementArticleView() {
  /* 浏览计数可后续加网关；试点忽略 */
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

export async function fetchMyNotes() {
  return apiFetchNotes();
}

export async function createNote(opts) {
  return apiCreateNote(opts);
}

export async function fetchSocialStatus(opts) {
  return apiSocialStatus(opts);
}

export async function chatWithAi(messages) {
  return apiChat(messages);
}
