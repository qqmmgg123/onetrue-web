"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { deleteNote, updateNote } from "../lib/api";
import { displayTitle, excerpt, formatWhen } from "../lib/format";
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

function memoExcerpt(n) {
  return excerpt(n.body || "", 180);
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
  const [menuId, setMenuId] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    setOrdered(sortMemos(notes));
  }, [notes]);

  useEffect(() => {
    if (!menuId) return undefined;
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuId("");
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuId]);

  const list = useMemo(() => ordered, [ordered]);

  async function confirmDelete(n) {
    if (!n?.id) return;
    const title = displayTitle(n.title, n.body, "备忘", n.format);
    if (!window.confirm(`确认删除「${title}」？`)) return;
    setBusyId(n.id);
    setMenuId("");
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
      await Promise.all(next.map((n, i) => updateNote(n.id, { sortOrder: i })));
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

  const detailNote = detail
    ? list.find((x) => x.id === detail.id) || detail
    : null;

  return (
    <div className="memo-grid-wrap">
      <p className="memo-sort-hint">长按或拖拽卡片可排序</p>
      <div className="memo-feed-grid">
        <button
          type="button"
          className="memo-feed-card memo-feed-add"
          onClick={openAdd}
        >
          <div className="body">
            <div className="card-title">＋ 添加备忘</div>
            <div className="card-excerpt">写一条新的备忘</div>
          </div>
        </button>
        {list.map((n) => {
          const title = displayTitle(n.title, n.body, "备忘", n.format);
          return (
            <div
              key={n.id}
              className={`memo-feed-card${dragId === n.id ? " dragging" : ""}`}
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
              <div className="memo-feed-card-top">
                <button
                  type="button"
                  className="memo-feed-card-main"
                  onClick={() => setDetail(n)}
                >
                  <div className="card-title">{title}</div>
                  <div className="card-excerpt">{memoExcerpt(n)}</div>
                  <div className="card-foot">
                    <span>{formatWhen(n.updatedAt)}</span>
                  </div>
                </button>
                <div
                  className="memo-card-more-wrap"
                  ref={menuId === n.id ? menuRef : null}
                >
                  <button
                    type="button"
                    className="memo-card-more"
                    aria-label="更多"
                    title="更多"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuId((id) => (id === n.id ? "" : n.id));
                    }}
                  >
                    ⋮
                  </button>
                  {menuId === n.id ? (
                    <div className="memo-card-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuId("");
                          onEdit?.(n);
                        }}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={busyId === n.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete(n);
                        }}
                      >
                        删除
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {list.length === 0 ? (
        <div className="empty" style={{ paddingTop: 8 }}>
          还没有备忘。点「＋ 添加备忘」新建一条。
        </div>
      ) : null}

      {detailNote ? (
        <div
          className="memo-modal-backdrop"
          role="presentation"
          onClick={() => setDetail(null)}
        >
          <div
            className="memo-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="memo-modal-bar">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setDetail(null)}
              >
                关闭
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setDetail(null);
                  onEdit?.(detailNote);
                }}
              >
                编辑
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={busyId === detailNote.id}
                onClick={() => confirmDelete(detailNote)}
              >
                删除
              </button>
            </div>
            <h2 className="memo-modal-title">
              {String(detailNote.title || "").trim() ||
                displayTitle(
                  detailNote.title,
                  detailNote.body,
                  "备忘",
                  detailNote.format,
                )}
            </h2>
            <div className="memo-modal-meta">
              添加时间{" "}
              {formatWhen(detailNote.createdAt || detailNote.updatedAt)}
            </div>
            <div className="memo-modal-body">
              <QuillBodyView body={detailNote.body} format={detailNote.format} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
