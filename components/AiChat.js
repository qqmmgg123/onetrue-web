"use client";

import { useEffect, useRef, useState } from "react";
import { chatWithAi } from "../lib/api";
import { useAuth } from "./AuthProvider";

const WELCOME =
  "可以随便聊；也能帮你整理想法、写大纲。\n完整记笔记、备忘与日程请用 App「作为」。";

export default function AiChat({ onNeedLogin, toast }) {
  const { isLoggedIn } = useAuth();
  const [messages, setMessages] = useState([
    { role: "assistant", content: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

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
    try {
      const reply = await chatWithAi(
        next.filter((m) => m.role === "user" || m.role === "assistant"),
      );
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      toast?.(e.message || "AI 失败");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `（出错）${e.message || "请稍后重试"}` },
      ]);
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
