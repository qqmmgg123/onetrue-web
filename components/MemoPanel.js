"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteNote, updateNote } from "../lib/api";
import { displayTitle, formatWhen } from "../lib/format";
import QuillBodyView from "./QuillBodyView";

function sortMemos(notes) {
  return (notes || [])
    .filter((n) => n.kind === "memo")
    .slice()
    .sort((a, b) => {
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (so !== 0) return so;
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
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
  const [ordered, setOrdered] = useState(() => sortMemos(notes));
  const [dragId, setDragId] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    setOrdered(sortMemos(notes));
  }, [notes]);

  const list = useMemo(() => ordered, [ordered]);

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

  async function persistOrder(next) {
    setSavingOrder(true);
    try {
      await Promise.all(
        next.map((n, i) => updateNote(n.id, { sortOrder: i })),
      );
      setOrdered(next.map((n, i) => ({ ...n, sortOrder: i })));
      toast?.("已调整顺序");
      await onChanged?.();
    } catch (e) {
      toast?.(e.message || "排序失败");
      setOrdered(sortMemos(notes));
    } finally {
      setSavingOrder(false);
    }
  }

  function onDropTarget(targetId) {
    if (!dragId || dragId === targetId || savingOrder) return;
    const from = list.findIndex((n) => n.id === dragId);
    const to = list.findIndex((n) => n.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = list.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrdered(next);
    persistOrder(next);
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
    const title = String(n.title || "").trim();
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
          {title || displayTitle(n.title, n.body, "备忘", n.format)}
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
      <p className="memo-sort-hint">长按或拖拽卡片可排序</p>
      <div className="memo-grid">
        <button
          type="button"
          className="memo-card memo-card-add"
          onClick={openAdd}
        >
          <span className="memo-card-add-label">＋ 添加备忘</span>
        </button>
        {list.map((n) => {
          const title = String(n.title || "").trim();
          return (
            <div
              key={n.id}
              className={`memo-card${dragId === n.id ? " dragging" : ""}`}
              draggable={!savingOrder}
              onDragStart={(e) => {
                setDragId(n.id);
                e.dataTransfer.effectAllowed = "move";
                try {
                  e.dataTransfer.setData("text/plain", n.id);
                } catch (_) {}
              }}
              onDragEnd={() => setDragId("")}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                onDropTarget(n.id);
                setDragId("");
              }}
            >
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
                {title ? (
                  <div className="memo-card-title">{title}</div>
                ) : null}
                <div className="memo-card-rich">
                  <QuillBodyView
                    body={n.body}
                    format={n.format}
                    emptyText=""
                    className="memo-card-quill"
                  />
                </div>
                <div className="memo-card-fade" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
      {list.length === 0 ? (
        <div className="empty" style={{ paddingTop: 8 }}>
          还没有备忘。点「＋ 添加备忘」新建一条。
        </div>
      ) : null}
    </div>
  );
}
