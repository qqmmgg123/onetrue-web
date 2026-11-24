"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { deleteNote, updateNote } from "../lib/api";
import { displayTitle, excerpt, formatWhen } from "../lib/format";
import QuillBodyView from "./QuillBodyView";

/** 与 App memo_sort 对齐 */
function memoGroup(n) {
  if (n.completedAt) return 2;
  if (n.pinnedAt) return 0;
  return 1;
}

function sortMemos(notes) {
  return (notes || [])
    .filter((n) => n.kind === "memo")
    .slice()
    .sort((a, b) => {
      const ga = memoGroup(a);
      const gb = memoGroup(b);
      if (ga !== gb) return ga - gb;
      if (ga === 0) {
        const c = String(b.pinnedAt || "").localeCompare(String(a.pinnedAt || ""));
        if (c) return c;
      } else if (ga === 2) {
        const c = String(a.completedAt || "").localeCompare(
          String(b.completedAt || ""),
        );
        if (c) return c;
      }
      const u = String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      if (u) return u;
      return String(b.id || "").localeCompare(String(a.id || ""));
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
  const [modalBusy, setModalBusy] = useState("");
  const [ordered, setOrdered] = useState(() => sortMemos(notes));
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

  async function withModalBusy(message, fn) {
    setModalBusy(message);
    try {
      await fn();
      await onChanged?.();
    } finally {
      setModalBusy("");
    }
  }

  async function confirmDelete(n) {
    if (!n?.id) return;
    const title = displayTitle(n.title, n.body, "备忘", n.format);
    if (!window.confirm(`确认删除「${title}」？`)) return;
    setBusyId(n.id);
    setMenuId("");
    try {
      await withModalBusy("正在删除…", async () => {
        await deleteNote(n.id);
        if (detail?.id === n.id) setDetail(null);
        toast?.("已删除");
      });
    } catch (e) {
      toast?.(e.message || "删除失败");
    } finally {
      setBusyId("");
    }
  }

  async function togglePin(n) {
    const pinned = Boolean(n.pinnedAt);
    try {
      await withModalBusy(pinned ? "取消置顶…" : "置顶中…", async () => {
        await updateNote(n.id, {
          pinnedAt: pinned ? null : new Date().toISOString(),
        });
        toast?.(pinned ? "已取消置顶" : "已置顶");
      });
    } catch (e) {
      toast?.(e.message || "操作失败");
    }
  }

  async function toggleDone(n) {
    const done = Boolean(n.completedAt);
    try {
      await withModalBusy(done ? "取消办结…" : "办结中…", async () => {
        await updateNote(n.id, {
          completedAt: done ? null : new Date().toISOString(),
        });
        toast?.(done ? "已恢复" : "已办结");
      });
    } catch (e) {
      toast?.(e.message || "操作失败");
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

  const detailNote = detail
    ? list.find((x) => x.id === detail.id) || detail
    : null;

  return (
    <div className="memo-grid-wrap">
      {modalBusy ? (
        <div className="memo-busy-backdrop" role="alert" aria-busy="true">
          <div className="memo-busy-dialog">
            <div className="memo-busy-spinner" />
            <span>{modalBusy}</span>
          </div>
        </div>
      ) : null}
      <div className="memo-feed-grid memo-feed-list">
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
          const done = Boolean(n.completedAt);
          const pinned = Boolean(n.pinnedAt);
          return (
            <div
              key={n.id}
              className={`memo-feed-card${done ? " is-done" : ""}${pinned ? " is-pinned" : ""}`}
            >
              <div className="memo-feed-card-top">
                <button
                  type="button"
                  className="memo-feed-card-main"
                  onClick={() => setDetail(n)}
                >
                  <div className={`card-title${done ? " struck" : ""}`}>
                    {title}
                  </div>
                  <div className={`card-excerpt${done ? " struck" : ""}`}>
                    {memoExcerpt(n)}
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
                      {!done ? (
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
                      ) : null}
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
              <div className="memo-card-foot-row">
                <span className="card-foot">{formatWhen(n.updatedAt)}</span>
                <div className="memo-card-actions">
                  <button
                    type="button"
                    className={`memo-pin-btn${pinned ? " on" : ""}`}
                    title={pinned ? "取消置顶" : "置顶"}
                    aria-label={pinned ? "取消置顶" : "置顶"}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(n);
                    }}
                  >
                    {pinned ? "📌" : "📍"}
                  </button>
                  <label
                    className="memo-done-check"
                    title={done ? "取消办结" : "办结"}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleDone(n)}
                    />
                  </label>
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
              {!detailNote.completedAt ? (
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
              ) : null}
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
