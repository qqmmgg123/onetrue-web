"use client";

import { useEffect, useRef, useState } from "react";
import { noteDraftAi } from "../lib/api";
import VoiceMicButton from "./VoiceMicButton";

const WELCOME =
  "我可以帮你改上方这篇：润色、排版、改形态/提醒/重复/上架…\n点右上角可开新对话；历史只属于这篇笔记。";

function storageKey(refKey) {
  return `tihu.noteAi.v1.${refKey || "draft"}`;
}

function loadMessages(refKey) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(refKey));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

function saveMessages(refKey, messages) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(refKey),
      JSON.stringify(messages.slice(-40)),
    );
  } catch (_) {}
}

/**
 * 笔记页 AI：立刻改草稿（无需确认），会话按 refKey 隔离。
 */
export default function NoteAiPanel({
  refKey = "draft",
  expanded = true,
  sideLayout = false,
  onExpandedChanged,
  getDraft,
  applyTools,
  toast,
}) {
  const open = sideLayout ? true : expanded;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    const loaded = loadMessages(refKey);
    setMessages(
      loaded.length
        ? loaded
        : [{ role: "assistant", content: WELCOME }],
    );
  }, [refKey]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, expanded]);

  function persist(next) {
    setMessages(next);
    saveMessages(refKey, next);
  }

  async function send(textOverride) {
    const text = String(textOverride ?? input).trim();
    if (!text || busy) return;
    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .filter((m) => m.content !== WELCOME)
      .map((m) => ({ role: m.role, content: m.content }));
    const next = [...messages, { role: "user", content: text }];
    persist(next);
    setInput("");
    setBusy(true);
    try {
      const draft = getDraft?.() || {};
      const data = await noteDraftAi({
        message: text,
        messages: history,
        draft,
      });
      const tips = [];
      const calls = data?.toolCalls || [];
      if (calls.length && applyTools) {
        const applied = applyTools(calls);
        if (Array.isArray(applied)) tips.push(...applied.filter(Boolean));
      }
      let reply = String(data?.reply || "").trim();
      if (tips.length) {
        reply = reply ? `${reply}\n${tips.join("\n")}` : tips.join("\n");
      }
      if (!reply) reply = calls.length ? "已处理。" : "可以说得更具体一点。";
      persist([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      toast?.(e.message || "笔记 AI 失败");
      persist([
        ...next,
        { role: "assistant", content: `没改成功：${e.message || "请稍后重试"}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function newChat() {
    const welcome = [{ role: "assistant", content: WELCOME }];
    persist(welcome);
    toast?.("已开新对话");
  }

  return (
    <div className={`note-ai ${open ? "open" : ""}${sideLayout ? " note-ai-side" : ""}`}>
      <div
        className="note-ai-head"
        onClick={sideLayout ? undefined : () => onExpandedChanged?.(!expanded)}
        role={sideLayout ? undefined : "button"}
        tabIndex={sideLayout ? undefined : 0}
        onKeyDown={
          sideLayout
            ? undefined
            : (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onExpandedChanged?.(!expanded);
                }
              }
        }
      >
        <strong>笔记 AI</strong>
        {!sideLayout ? (
          <span className="sub">{open ? "收起" : "展开改这篇"}</span>
        ) : (
          <span className="sub">改这篇草稿</span>
        )}
        <div
          className="note-ai-head-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="btn ghost"
            style={{ fontSize: 12, padding: "4px 8px" }}
            onClick={newChat}
          >
            新对话
          </button>
        </div>
      </div>
      {open ? (
        <>
          <div className="note-ai-log" ref={logRef}>
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.content}
              </div>
            ))}
            {busy ? <div className="bubble assistant">改稿中…</div> : null}
          </div>
          <div className="note-ai-input">
            <textarea
              rows={1}
              value={input}
              placeholder="润色、扩写、改成日程…（Enter 发送）"
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <VoiceMicButton
              mode="push"
              disabled={busy}
              toast={toast}
              onText={(t) => {
                setInput((prev) => (prev ? `${prev}${t}` : t));
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
