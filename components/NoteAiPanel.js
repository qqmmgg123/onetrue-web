"use client";

import { useEffect, useRef, useState } from "react";
import {
  countLikelySpanEditOps,
  extractPseudoToolCalls,
  extractSpanEditIntents,
  inferKindFromUserText,
  looksLikeAppendRequest,
  looksLikeWriteRequest,
  missingSpanInsertTexts,
  pickDraftPlain,
  sanitizeAiPlainText,
  tipIsSpanEdit,
} from "../lib/ai-plain";
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
  onBusyChange,
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

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

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
      const tips = [];
      // 改类型 / 写备忘·文章·日常：先切形态，避免模型只写正文不改 kind
      const inferredKind = inferKindFromUserText(textForAgent);
      if (
        inferredKind &&
        applyTools &&
        draft?.options?.kind !== inferredKind
      ) {
        const kindTips = applyTools([
          { name: "set_note_options", args: { kind: inferredKind } },
        ]);
        if (Array.isArray(kindTips)) tips.push(...kindTips.filter(Boolean));
      }
      let data = await noteDraftAi({
        message: textForAgent,
        messages: history,
        draft: getDraft?.() || draft,
      });
      const wantAppend = looksLikeAppendRequest(textForAgent);
      const remapCalls = (calls) => {
        if (!calls?.length) return [];
        if (!wantAppend) return calls;
        return calls.map((c) => {
          if (c.name !== "replace_draft" && c.name !== "replace_delta") {
            return c;
          }
          let plain = pickDraftPlain(c.args || {});
          if (!plain && Array.isArray(c.args?.delta)) {
            plain = c.args.delta
              .map((op) => (typeof op?.insert === "string" ? op.insert : ""))
              .join("")
              .replace(/\n+$/, "")
              .trim();
          }
          plain = sanitizeAiPlainText(plain || "");
          return { name: "append_draft", args: { plain } };
        });
      };
      const applyCalls = (calls) => {
        const mapped = remapCalls(calls);
        if (!applyTools) return [];
        // 即使模型没出 tool，也传入 userText，便于本地按话术补全局部插入
        if (!mapped?.length && !extractSpanEditIntents(textForAgent).length) {
          return [];
        }
        const applied = applyTools(mapped || [], { userText: textForAgent });
        return Array.isArray(applied) ? applied.filter(Boolean) : [];
      };
      let calls = data?.toolCalls || [];
      if (!calls.length) {
        const pseudo = extractPseudoToolCalls(data?.reply || data?.content || "");
        if (pseudo.calls.length) {
          calls = pseudo.calls;
          data = { ...data, reply: pseudo.cleaned, content: pseudo.cleaned };
        }
      }
      tips.push(...applyCalls(calls));
      const tipIsWrite = (t) =>
        t.includes("已写入正文") ||
        t.includes("富文本写入") ||
        t.includes("已追加正文") ||
        t.includes("已删除指定片段") ||
        t.includes("已改写指定片段") ||
        t.includes("已在指定句");
      let wroteBody = tips.some(tipIsWrite);
      const draftPlainEmpty = !String(
        (getDraft?.() || draft).plain || "",
      ).trim();
      const wantWrite =
        !wantAppend &&
        (looksLikeWriteRequest(textForAgent) ||
          (draftPlainEmpty && tips.some((t) => t.includes("已改标题"))));
      // 模型常只改标题——强制 tool_choice=replace_draft 再写一轮
      if (wantWrite && !wroteBody) {
        const retryDraft = getDraft?.() || draft;
        data = await noteDraftAi({
          message:
            "上一次没有真正调用 replace_draft 把完整正文写入编辑器。请立刻调用 replace_draft，在 plain 参数写入完整文章正文（纯文本、多段落）。禁止只改标题，禁止只回复「已写入正文」。",
          messages: [
            ...history,
            { role: "user", content: textForAgent },
            {
              role: "assistant",
              content:
                tips.join("；") ||
                String(data?.reply || "（未写入正文）"),
            },
          ],
          draft: retryDraft,
          forceReplaceDraft: true,
        });
        let retryCalls = data?.toolCalls || [];
        if (!retryCalls.length) {
          const pseudo = extractPseudoToolCalls(
            data?.reply || data?.content || "",
          );
          if (pseudo.calls.length) {
            retryCalls = pseudo.calls;
            data = { ...data, reply: pseudo.cleaned, content: pseudo.cleaned };
          }
        }
        tips.push(...applyCalls(retryCalls));
        wroteBody = tips.some(tipIsWrite);
      }
      // 追加类请求若模型没调工具，再强制一轮 append（用 replace 强制后客户端改写）
      if (wantAppend && !wroteBody) {
        const retryDraft = getDraft?.() || draft;
        data = await noteDraftAi({
          message:
            "用户要求在文末追加文字。请调用 append_draft（或 replace_draft 且 plain 仅为要追加的那一句/那段），禁止用整篇新正文覆盖原文。",
          messages: [
            ...history,
            { role: "user", content: textForAgent },
            {
              role: "assistant",
              content: tips.join("；") || String(data?.reply || "（未追加）"),
            },
          ],
          draft: retryDraft,
          forceReplaceDraft: true,
        });
        let appendCalls = data?.toolCalls || [];
        if (!appendCalls.length) {
          const pseudo = extractPseudoToolCalls(
            data?.reply || data?.content || "",
          );
          if (pseudo.calls.length) {
            appendCalls = pseudo.calls;
            data = { ...data, reply: pseudo.cleaned, content: pseudo.cleaned };
          }
        }
        tips.push(...applyCalls(appendCalls));
        wroteBody = tips.some(tipIsWrite);
      }
      // 多处局部编辑：模型常只做第一处 —— 按估算次数补全
      const spanIntents = extractSpanEditIntents(textForAgent);
      const expectedSpan = spanIntents.length
        ? spanIntents.length
        : countLikelySpanEditOps(textForAgent);
      let spanDone = tips.filter(tipIsSpanEdit).length;
      const spanPlain = String((getDraft?.() || {}).plain || "");
      const spanComplete =
        spanIntents.length > 0 &&
        missingSpanInsertTexts(spanPlain, spanIntents).length === 0;
      if (!spanComplete && expectedSpan >= 2 && spanDone < expectedSpan) {
        const retryDraft = getDraft?.() || draft;
        data = await noteDraftAi({
          message: `用户原话要求约 ${expectedSpan} 处局部修改，目前只完成了 ${spanDone} 处。请立刻对其余步骤继续调用 edit_span（同一轮可多次，按用户顺序）。同一锚点连续「后面写」请合并为一次 insert_after（text 按顺序拼接），或后一次 find 用上一处刚插入的文字。禁止只回复文字不调工具。`,
          messages: [
            ...history,
            { role: "user", content: textForAgent },
            {
              role: "assistant",
              content: tips.join("；") || String(data?.reply || "（未完成全部局部修改）"),
            },
          ],
          draft: retryDraft,
        });
        let spanCalls = data?.toolCalls || [];
        if (!spanCalls.length) {
          const pseudo = extractPseudoToolCalls(
            data?.reply || data?.content || "",
          );
          if (pseudo.calls.length) {
            spanCalls = pseudo.calls;
            data = { ...data, reply: pseudo.cleaned, content: pseudo.cleaned };
          }
        }
        tips.push(...applyCalls(spanCalls));
        wroteBody = tips.some(tipIsWrite);
        spanDone = tips.filter(tipIsSpanEdit).length;
        if (spanDone < expectedSpan) {
          const againDraft = getDraft?.() || draft;
          data = await noteDraftAi({
            message: `仍未做完。用户原话：${textForAgent}\n请把剩余局部修改全部用 edit_span 做完（可多次调用）。`,
            messages: [
              ...history,
              { role: "user", content: textForAgent },
              {
                role: "assistant",
                content: tips.join("；") || "（仍未完成）",
              },
            ],
            draft: againDraft,
          });
          let more = data?.toolCalls || [];
          if (!more.length) {
            const pseudo = extractPseudoToolCalls(
              data?.reply || data?.content || "",
            );
            if (pseudo.calls.length) {
              more = pseudo.calls;
              data = { ...data, reply: pseudo.cleaned, content: pseudo.cleaned };
            }
          }
          tips.push(...applyCalls(more));
          wroteBody = tips.some(tipIsWrite);
        }
      }
      let reply = String(data?.reply || "").trim();
      // 再清一次伪工具转储，避免出现在气泡里
      {
        const scrub = extractPseudoToolCalls(reply);
        if (scrub.calls.length) reply = scrub.cleaned;
      }
      if (
        !wroteBody &&
        /已写入正文|已写入|正文已更新|已追加|已删除|已改写/.test(reply)
      ) {
        reply = "";
      }
      // 只展示有意义的 tip，避免「已改标题」单独冒充完成
      const tipLine = tips.filter(Boolean).join("\n");
      if (tipLine) {
        reply = reply ? `${reply}\n${tipLine}` : tipLine;
      }
      if (!reply) {
        reply = wroteBody
          ? "已写入正文"
          : tips.length
            ? "已处理。"
            : "可以说得更具体一点。";
      } else if (wantWrite && !wroteBody) {
        reply = `${reply}\n未能写入正文，请再试一次或换个说法。`;
      }
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
            {busy ? <div className="bubble assistant">思考中…</div> : null}
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
