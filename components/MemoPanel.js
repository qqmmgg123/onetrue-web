"use client";

import { useMemo, useState } from "react";
import { deleteNote } from "../lib/api";
import { displayTitle, formatWhen, plainTextFromBody } from "../lib/format";
import QuillBodyView from "./QuillBodyView";

function cardText(n) {
  const title = String(n.title || "").trim();
  const plain = plainTextFromBody(n.body, n.format)
    .replace(/\s+/g, " ")
    .trim();
  if (title && plain && plain !== title) return `${title}\n${plain}`;
  if (title) return title;
  if (plain) return plain;
  return displayTitle(n.title, n.body, "备忘", n.format);
}

export default function MemoPanel({
  notes = [],
  loading = false,
  isLoggedIn,
  onNeedLogin,
  onCompose,
  onEdit,
  onChanged,
  toast,
}) {
  const [detail, setDetail] = useState(null);
  const [busyId, setBusyId] = useState("");

  const list = useMemo(
    () =>
      (notes || [])
        .filter((n) => n.kind === "memo")
        .slice()
        .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))),
    [notes],
  );

  async function confirmDelete(n) {
    if (!n?.id) return;
    const title = displayTitle(n.title, n.body, "备忘", n.format);
    if (!window.confirm(`确认删除「${title}」？`)) return;
    setBusyId(n.id);
    try {
      await deleteNote(n.id);
      if (detail?.id === n.id) setDetail(null);
      toast?.("已删除");
      await onChanged?.();
    } catch (e) {
      toast?.(e.message || "删除失败");
    } finally {
      setBusyId("");
    }
  }

  function openAdd() {
    if (!isLoggedIn) return onNeedLogin?.();
    onCompose?.({ kind: "memo" });
  }

  if (loading) {
    return <div className="panel-loading">加载备忘中…</div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="empty login-cta">
        <p>登录后开始写备忘</p>
        <button type="button" className="btn" onClick={() => onNeedLogin?.()}>
          去登录
        </button>
      </div>
    );
  }

  if (detail) {
    const n = list.find((x) => x.id === detail.id) || detail;
    return (
      <div className="memo-detail">
        <div className="memo-detail-bar">
          <button
            type="button"
            className="btn ghost"
            onClick={() => setDetail(null)}
          >
            返回
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn ghost"
            onClick={() => onEdit?.(n)}
          >
            编辑
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busyId === n.id}
            onClick={() => confirmDelete(n)}
          >
            删除
          </button>
        </div>
        <h2 className="memo-detail-title">
          {displayTitle(n.title, n.body, "备忘", n.format)}
        </h2>
        <div className="memo-detail-meta">
          添加时间 {formatWhen(n.createdAt || n.updatedAt)}
        </div>
        <div className="memo-detail-body">
          <QuillBodyView body={n.body} format={n.format} />
        </div>
      </div>
    );
  }

  return (
    <div className="memo-grid-wrap">
      <div className="memo-grid">
        <button type="button" className="memo-card memo-card-add" onClick={openAdd}>
          <span className="memo-card-add-label">＋ 添加备忘</span>
        </button>
        {list.map((n) => (
          <div key={n.id} className="memo-card">
            <div className="memo-card-actions">
              <button
                type="button"
                className="btn ghost"
                title="编辑"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(n);
                }}
              >
                编辑
              </button>
              <button
                type="button"
                className="btn ghost"
                title="删除"
                disabled={busyId === n.id}
                onClick={(e) => {
                  e.stopPropagation();
                  confirmDelete(n);
                }}
              >
                删
              </button>
            </div>
            <button
              type="button"
              className="memo-card-body"
              onClick={() => setDetail(n)}
            >
              <div className="memo-card-text">{cardText(n)}</div>
              <div className="memo-card-meta">{formatWhen(n.updatedAt)}</div>
            </button>
          </div>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="empty" style={{ paddingTop: 8 }}>
          还没有备忘。点「＋ 添加备忘」新建一条。
        </div>
      ) : null}
    </div>
  );
}
