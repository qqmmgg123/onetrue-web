"use client";

import { useEffect, useRef, useState } from "react";
import { chatWithAi, confirmAiAction } from "../lib/api";
import {
  createChatSession,
  getChatSession,
  updateChatSession,
} from "../lib/chat-store";
import { useAuth } from "./AuthProvider";
import VoiceMicButton from "./VoiceMicButton";

export default function AiChat({
  sessionId,
  onSessionChange,
  onNeedLogin,
  onNotesChanged,
  toast,
}) {
  const { isLoggedIn } = useAuth();
  const [sid, setSid] = useState(sessionId || "");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    let id = sessionId;
    if (!id) {
      const s = createChatSession();
      id = s.id;
      onSessionChange?.(id);
    }
    setSid(id);
    const s = getChatSession(id);
    setMessages(s?.messages || []);
  }, [sessionId]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  function persist(next, title) {
    const t =
      title ||
      next.find((m) => m.role === "user")?.content?.slice(0, 24) ||
      "新对话";
    updateChatSession(sid, { messages: next, title: t });
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    if (!isLoggedIn) {
      onNeedLogin?.();
      return;
    }
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    persist(next);
    try {
      const data = await chatWithAi(
        next
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content })),
      );
      const reply = typeof data === "string" ? data : data?.reply || "";
      const pending = typeof data === "object" ? data?.pending || null : null;
      const withReply = [
        ...next,
        {
          role: "assistant",
          content: reply,
          pending: pending || undefined,
          confirmed: pending ? null : undefined,
        },
      ];
      setMessages(withReply);
      persist(withReply);
    } catch (e) {
      toast?.(e.message || "AI 失败");
      const withErr = [
        ...next,
        {
          role: "assistant",
          content: `（出错）${e.message || "请稍后重试"}`,
        },
      ];
      setMessages(withErr);
      persist(withErr);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(index, pending) {
    if (busy || !pending) return;
    setBusy(true);
    try {
      const result = await confirmAiAction(pending);
      const text = result?.result || result?.reply || "已执行";
      setMessages((prev) => {
        const next = prev.map((m, i) =>
          i === index
            ? { ...m, confirmed: true, pending }
            : m,
        );
        const withResult = [
          ...next,
          { role: "assistant", content: text },
        ];
        persist(withResult);
        return withResult;
      });
      onNotesChanged?.();
      toast?.("已写入笔记本");
    } catch (e) {
      toast?.(e.message || "执行失败");
    } finally {
      setBusy(false);
    }
  }

  function cancel(index, pending) {
    setMessages((prev) => {
      const next = prev.map((m, i) =>
        i === index ? { ...m, confirmed: false, pending } : m,
      );
      persist(next);
      return next;
    });
    toast?.("已取消");
  }

  return (
    <div className="chat">
      <div className="chat-log" ref={logRef}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            <div className="bubble-text">{m.content}</div>
            {m.pending && m.confirmed == null ? (
              <div className="pending-actions">
                <div className="pending-summary">{m.pending.summary}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => confirm(i, m.pending)}
                  >
                    确认
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => cancel(i, m.pending)}
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : null}
            {m.confirmed === true ? (
              <div className="pending-status ok">已确认</div>
            ) : null}
            {m.confirmed === false ? (
              <div className="pending-status">已取消</div>
            ) : null}
          </div>
        ))}
        {busy ? <div className="bubble assistant">思考中…</div> : null}
      </div>
      <div className="chat-input">
        <textarea
          rows={1}
          value={input}
          placeholder={
            isLoggedIn
              ? "说点什么… 也可让我记笔记（Enter 发送）"
              : "登录后找 AI"
          }
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
          disabled={busy || !isLoggedIn}
          toast={toast}
          onText={(t) => setInput((prev) => (prev ? `${prev}${t}` : t))}
        />
      </div>
    </div>
  );
}
