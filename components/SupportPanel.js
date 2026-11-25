"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMyFeedback, submitFeedback } from "../lib/api";
import { formatWhen } from "../lib/format";
import { appDownloadHint } from "../lib/site";
import { useAuth } from "./AuthProvider";

const SUPPORT_EMAIL = "290448666@qq.com";

/** 联系与反馈（其他 → 第二项） */
export default function SupportPanel({ toast }) {
  const { isLoggedIn } = useAuth();
  const [view, setView] = useState("home"); // home | feedback
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!isLoggedIn) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchMyFeedback();
      setItems(list);
    } catch (e) {
      toast?.(e.message || "加载反馈失败");
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, toast]);

  useEffect(() => {
    if (view === "feedback") load();
  }, [view, load]);

  if (view === "feedback") {
    return (
      <div className="panel support-panel" style={{ maxWidth: 560 }}>
        <div className="support-feedback-head">
          <button
            type="button"
            className="btn ghost"
            onClick={() => setView("home")}
          >
            返回
          </button>
          <h2>我的反馈</h2>
        </div>
        <p className="hint">描述问题或建议，我们会尽快查看。</p>

        {!isLoggedIn ? (
          <div className="empty">登录后可提交与查看反馈</div>
        ) : (
          <>
            <div className="field">
              <label>反馈内容</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="请描述你遇到的问题或想提的建议…"
                rows={5}
              />
            </div>
            <div className="field">
              <label>联系方式（可选）</label>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="邮箱 / 微信号等，方便我们回复"
              />
            </div>
            <button
              type="button"
              className="btn"
              disabled={busy || !body.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  const item = await submitFeedback({
                    body: body.trim(),
                    contact: contact.trim(),
                  });
                  setBody("");
                  setItems((prev) => (item ? [item, ...prev] : prev));
                  toast?.("已提交反馈");
                } catch (e) {
                  toast?.(e.message || "提交失败");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "提交中…" : "提交反馈"}
            </button>

            <h3 className="support-list-title">已提交</h3>
            {loading ? (
              <div className="loading">加载中…</div>
            ) : items.length === 0 ? (
              <div className="empty">还没有反馈记录</div>
            ) : (
              <ul className="support-feedback-list">
                {items.map((it) => (
                  <li key={it.id}>
                    <div className="support-feedback-meta">
                      {formatWhen(it.createdAt)}
                      {it.contact ? ` · ${it.contact}` : ""}
                    </div>
                    <div className="support-feedback-body">{it.body}</div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="panel support-panel" style={{ maxWidth: 560 }}>
      <h2>联系与反馈</h2>
      <p className="hint">
        您好，使用过程中有什么问题，或有什么建议，可通过下方联系方式联系我们，或提交应用内反馈，非常感谢您对醍醐的支持，愿在您的督促下，我们的未来会更好。
      </p>
      <div className="settings-list">
        <div className="row support-email-row">
          <span className="support-email-label">邮箱</span>
          <a className="sub support-email-value" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </div>
        <button type="button" onClick={() => setView("feedback")}>
          <span>提交反馈</span>
          <span className="sub">意见与问题</span>
        </button>
        <a href="/download">
          <span>{appDownloadHint()}</span>
          <span className="sub">下载页</span>
        </a>
      </div>
    </div>
  );
}
