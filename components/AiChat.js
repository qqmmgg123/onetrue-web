"use client";

import { useEffect, useRef, useState } from "react";
import { chatWithAi } from "../lib/api";
import {
  createChatSession,
  getChatSession,
  updateChatSession,
} from "../lib/chat-store";
import { useAuth } from "./AuthProvider";

export default function AiChat({
  sessionId,
  onSessionChange,
  onNeedLogin,
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
    const title =
      next.find((m) => m.role === "user")?.content?.slice(0, 24) || "新对话";
    updateChatSession(sid, { messages: next, title });
    try {
      const reply = await chatWithAi(
        next.filter((m) => m.role === "user" || m.role === "assistant"),
      );
      const withReply = [...next, { role: "assistant", content: reply }];
      setMessages(withReply);
      updateChatSession(sid, { messages: withReply, title });
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
      updateChatSession(sid, { messages: withErr });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat">
      <div className="chat-log" ref={logRef}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.content}
          </div>
        ))}
        {busy ? <div className="bubble assistant">思考中…</div> : null}
      </div>
      <div className="chat-input">
        <textarea
          rows={1}
          value={input}
          placeholder={isLoggedIn ? "说点什么…" : "登录后找 AI"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn" type="button" disabled={busy} onClick={send}>
          发送
        </button>
      </div>
    </div>
  );
}
