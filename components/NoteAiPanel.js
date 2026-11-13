"use client";

import { useEffect, useRef, useState } from "react";
import { noteDraftAi, visionUnderstand } from "../lib/api";
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
 * 底部输入对齐 App：圆角输入 + 识图 + 点按听写 + 发送。
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
  const [pendingImage, setPendingImage] = useState(null); // { file, url }
  const logRef = useRef(null);
  const micRef = useRef(null);
  const fileRef = useRef(null);
  const voiceInserting = useRef(false);

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

  useEffect(() => {
    return () => {
      if (pendingImage?.url) URL.revokeObjectURL(pendingImage.url);
    };
  }, [pendingImage]);

  function persist(next) {
    setMessages(next);
    saveMessages(refKey, next);
  }

  function onInputChange(e) {
    const v = e.target.value;
    setInput(v);
    if (!voiceInserting.current) {
      micRef.current?.stopIfActive?.();
    }
  }

  function clearImage() {
    if (pendingImage?.url) URL.revokeObjectURL(pendingImage.url);
    setPendingImage(null);
  }

  function pickImage(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      toast?.("请选择图片文件");
      return;
    }
    if (pendingImage?.url) URL.revokeObjectURL(pendingImage.url);
    setPendingImage({ file, url: URL.createObjectURL(file) });
  }

  async function send(textOverride) {
    const typed = String(textOverride ?? input).trim();
    const image = pendingImage?.file || null;
    if ((!typed && !image) || busy) return;

    micRef.current?.stopIfActive?.();

    let textForAgent = typed;
    let textForBubble = typed;
    let next = messages;
    let userPushed = false;
    setBusy(true);
    try {
      if (image) {
        toast?.("正在识图…");
        const result = await visionUnderstand({
          file: image,
          prompt:
            typed || "请理解图中文字或内容，用于改笔记。用简洁中文说明。",
        });
        const ask = typed || "请根据附图帮助改这篇笔记";
        textForAgent = `${ask}\n\n【附图理解 · ${result.source}】\n${result.text}`;
        textForBubble = `${ask}\n\n📷 ${result.text}`;
        clearImage();
      }

      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => m.content !== WELCOME)
        .map((m) => ({ role: m.role, content: m.content }));
      next = [...messages, { role: "user", content: textForBubble }];
      userPushed = true;
      persist(next);
      setInput("");

      const draft = getDraft?.() || {};
      const data = await noteDraftAi({
        message: textForAgent,
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
      const failMsg = `没改成功：${e.message || "请稍后重试"}`;
      if (userPushed) {
        persist([...next, { role: "assistant", content: failMsg }]);
      } else {
        persist([...messages, { role: "assistant", content: failMsg }]);
      }
    } finally {
      setBusy(false);
    }
  }

  function newChat() {
    const welcome = [{ role: "assistant", content: WELCOME }];
    persist(welcome);
    toast?.("已开新对话");
  }

  const canSend = Boolean(input.trim() || pendingImage) && !busy;

  return (
    <div
      className={`note-ai ${open ? "open" : ""}${sideLayout ? " note-ai-side" : ""}`}
    >
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

          <div className="note-ai-composer">
            {pendingImage ? (
              <div className="note-ai-attach">
                <img src={pendingImage.url} alt="附图预览" />
                <span className="sub">已附图 · 写上要求后发送</span>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy}
                  onClick={clearImage}
                >
                  清除
                </button>
              </div>
            ) : null}

            <div className="note-ai-composer-row">
              <textarea
                rows={1}
                value={input}
                placeholder="润色、扩写、改成日程…"
                disabled={busy}
                onChange={onInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <div className="note-ai-composer-actions">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={pickImage}
                />
                <button
                  type="button"
                  className="note-ai-icon-btn"
                  disabled={busy}
                  title="附图识图"
                  aria-label="附图识图"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImageIcon />
                </button>
                <VoiceMicButton
                  ref={micRef}
                  disabled={busy}
                  toast={toast}
                  onText={(t) => {
                    voiceInserting.current = true;
                    setInput((prev) => (prev ? `${prev}${t}` : t));
                    queueMicrotask(() => {
                      voiceInserting.current = false;
                    });
                  }}
                />
                <button
                  type="button"
                  className="note-ai-send"
                  disabled={!canSend}
                  title="发送"
                  aria-label="发送"
                  onClick={() => send()}
                >
                  <SendIcon />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path
        d="m7 17 4-4 3 3 3-4 3 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M12 19V5M12 5l-6 6M12 5l6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
