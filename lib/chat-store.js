"use client";

const KEY = "tihu.web.chat.sessions.v1";

function loadAll() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

function saveAll(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function listChatSessions() {
  return loadAll().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getChatSession(id) {
  return loadAll().find((s) => s.id === id) || null;
}

export function createChatSession(title = "新对话") {
  const session = {
    id: crypto.randomUUID(),
    title,
    messages: [
      {
        role: "assistant",
        content:
          "可以随便聊；也能帮你整理想法、写大纲。\n左侧「作为」可写笔记；复杂日程仍建议用 App。",
      },
    ],
    updatedAt: Date.now(),
  };
  const all = loadAll();
  all.unshift(session);
  saveAll(all);
  return session;
}

export function updateChatSession(id, patch) {
  const all = loadAll();
  const i = all.findIndex((s) => s.id === id);
  if (i < 0) return null;
  all[i] = { ...all[i], ...patch, updatedAt: Date.now() };
  saveAll(all);
  return all[i];
}

export function deleteChatSession(id) {
  saveAll(loadAll().filter((s) => s.id !== id));
}
