"use client";

import { useEffect, useRef, useState } from "react";
import {
  addComment,
  fetchProfiles,
  fetchSocialStatus,
  incrementArticleView,
  listComments,
  toggleFavorite,
  toggleFollow,
  toggleRecommend,
} from "../lib/api";
import { displayTitle, formatWhen } from "../lib/format";
import { upsertArticleRead } from "../lib/recent-reads";
import { articleSharePath } from "../lib/site";
import { useAuth } from "./AuthProvider";
import { IconHeart, IconStar } from "./icons";
import QuillBodyView from "./QuillBodyView";
import UserAvatar from "./UserAvatar";

const recentViewBump = new Map();

export default function ArticleReader({
  article,
  highlightCommentId = "",
  onNeedLogin,
  onOpenAuthor,
  onEdit,
  onReadRecorded,
  toast,
}) {
  const { user, isLoggedIn } = useAuth();
  const [author, setAuthor] = useState(null);
  const [comments, setComments] = useState([]);
  const [recommended, setRecommended] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [following, setFollowing] = useState(false);
  const [recCount, setRecCount] = useState(article?.recommendCount || 0);
  const [viewCount, setViewCount] = useState(article?.viewCount || 0);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const commentRefs = useRef({});

  useEffect(() => {
    if (!article?.id) return;
    let alive = true;
    (async () => {
      try {
        const profiles = await fetchProfiles([article.ownerId]);
        if (alive) setAuthor(profiles[article.ownerId] || null);
        const cs = await listComments(article.id);
        if (alive) setComments(cs);
        if (isLoggedIn) {
          const st = await fetchSocialStatus({
            noteId: article.id,
            ownerId: article.ownerId,
          });
          if (alive) {
            setRecommended(Boolean(st?.recommended));
            setFavorited(Boolean(st?.favorited));
            setFollowing(Boolean(st?.following));
          }
        } else if (alive) {
          setRecommended(false);
          setFavorited(false);
          setFollowing(false);
        }
      } catch (e) {
        toast?.(e.message || "加载失败");
      }
    })();
    setRecCount(article.recommendCount || 0);
    setViewCount(article.viewCount || 0);
    setReplyTo(null);
    setCommentText("");

    // 本机近期阅读 + 非作者浏览 +1（短时去重，避免 StrictMode 双计）
    try {
      upsertArticleRead(article);
      onReadRecorded?.();
    } catch (_) {}
    const last = recentViewBump.get(article.id) || 0;
    if (Date.now() - last > 4000) {
      recentViewBump.set(article.id, Date.now());
      incrementArticleView(article.id)
        .then((r) => {
          if (!alive || r?.skipped || r?.viewCount == null) return;
          setViewCount(r.viewCount);
        })
        .catch(() => {});
    }

    return () => {
      alive = false;
    };
  }, [article?.id, article?.ownerId, isLoggedIn, user?.id]);

  useEffect(() => {
    const hid = String(highlightCommentId || "").trim();
    if (!hid || !comments.length) return;
    const t = window.setTimeout(() => {
      const el = commentRefs.current[hid];
      if (el?.scrollIntoView) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [highlightCommentId, comments, article?.id]);

  if (!article) {
    return <div className="empty">选择一篇文章开始阅读</div>;
  }

  const title = displayTitle(article.title, article.body);
  const isMine = user?.id && user.id === article.ownerId;

  async function guard(fn) {
    if (!isLoggedIn) {
      onNeedLogin?.();
      return;
    }
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast?.(e.message || "操作失败");
    } finally {
      setBusy(false);
    }
  }

  function startReply(c) {
    if (!isLoggedIn) {
      onNeedLogin?.();
      return;
    }
    setReplyTo({
      id: c.id,
      authorId: c.authorId,
      authorNickname: c.authorNickname || "用户",
    });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <article className="reader">
      <h1 className="reader-title">{title}</h1>
      <div className="reader-meta">
        <UserAvatar profile={author} />
        <div>
          <div className="name">
            {author?.displayName || "作者"}
            {article.city ? (
              <span className="sub"> · {article.city}</span>
            ) : null}
          </div>
          <div className="sub">
            {formatWhen(article.listedAt)}
            {viewCount != null ? ` · ${viewCount} 阅读` : ""}
            {` · ${recCount} 推荐 · ${article.commentCount || comments.length} 评点`}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {!isMine && article.ownerId ? (
          <button
            className={`btn ghost ${following ? "on" : ""}`}
            disabled={busy}
            onClick={() =>
              guard(async () => {
                const next = await toggleFollow(article.ownerId);
                setFollowing(next);
                toast?.(next ? "已留意" : "已取消留意");
              })
            }
          >
            {following ? "已留意" : "留意"}
          </button>
        ) : null}
        {isMine && onEdit ? (
          <button className="btn ghost" onClick={onEdit}>
            编辑
          </button>
        ) : null}
        {onOpenAuthor ? (
          <button className="btn ghost" onClick={onOpenAuthor}>
            陋室
          </button>
        ) : null}
      </div>

      <div className="reader-body">
        <QuillBodyView body={article.body} format={article.format} />
      </div>

      <div className="reader-actions">
        <button
          className={`btn ghost ${recommended ? "on" : ""}`}
          disabled={busy || isMine}
          onClick={() =>
            guard(async () => {
              const res = await toggleRecommend(article.id, article.ownerId);
              setRecommended(res.recommended);
              setRecCount(res.count);
            })
          }
        >
          <IconHeart filled={recommended} />
          推荐 {recCount}
        </button>
        <button
          className={`btn ghost ${favorited ? "on" : ""}`}
          disabled={busy}
          onClick={() =>
            guard(async () => {
              const next = await toggleFavorite(article.id);
              setFavorited(next);
              toast?.(next ? "已收藏" : "已取消收藏");
            })
          }
        >
          <IconStar filled={favorited} />
          收藏
        </button>
        <button
          className="btn ghost"
          onClick={async () => {
            const url = `${window.location.origin}${articleSharePath(article.id)}`;
            try {
              await navigator.clipboard.writeText(url);
              toast?.("链接已复制");
            } catch (_) {
              toast?.(url);
            }
          }}
        >
          分享链接
        </button>
      </div>

      <div className="comments">
        <h3>评点</h3>
        {comments.length === 0 ? (
          <div className="empty" style={{ padding: "16px 0" }}>
            还没有评点
          </div>
        ) : (
          comments.map((c) => (
            <div
              className={`comment${
                highlightCommentId && highlightCommentId === c.id
                  ? " comment-highlight"
                  : ""
              }`}
              key={c.id}
              ref={(el) => {
                if (el) commentRefs.current[c.id] = el;
                else delete commentRefs.current[c.id];
              }}
            >
              <UserAvatar
                size="sm"
                name={c.authorNickname}
                profile={{
                  displayName: c.authorNickname,
                  avatarUrl: c.authorAvatarUrl,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="who">
                  {c.authorNickname || "用户"}
                  <span className="when">{formatWhen(c.createdAt)}</span>
                </div>
                <div className="text">
                  {c.replyToNickname ? `回书 ${c.replyToNickname}：` : ""}
                  {c.body}
                </div>
                <button
                  type="button"
                  className="btn ghost"
                  style={{
                    fontSize: 12,
                    padding: "2px 0",
                    marginTop: 4,
                    color: "#666",
                  }}
                  disabled={busy}
                  onClick={() => startReply(c)}
                >
                  回书
                </button>
              </div>
            </div>
          ))
        )}
        <form
          className="comment-form"
          onSubmit={(e) => {
            e.preventDefault();
            guard(async () => {
              const c = await addComment({
                noteId: article.id,
                body: commentText,
                noteOwnerId: article.ownerId,
                parentId: replyTo?.id || undefined,
                replyToUserId: replyTo?.authorId || undefined,
              });
              if (c && replyTo && !c.replyToNickname) {
                c.replyToNickname = replyTo.authorNickname;
              }
              setComments((prev) => [...prev, c]);
              setCommentText("");
              setReplyTo(null);
            });
          }}
        >
          {replyTo ? (
            <div
              style={{
                flex: "1 0 100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "#555",
              }}
            >
              <span>
                回书 <strong>{replyTo.authorNickname}</strong>
              </span>
              <button
                type="button"
                className="btn ghost"
                style={{ fontSize: 12, padding: "2px 8px" }}
                onClick={() => setReplyTo(null)}
              >
                取消
              </button>
            </div>
          ) : null}
          <input
            ref={inputRef}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={
              !isLoggedIn
                ? "登录后评点"
                : replyTo
                  ? `回书 ${replyTo.authorNickname}…`
                  : "写一条评点…"
            }
            disabled={!isLoggedIn || busy}
          />
          <button className="btn" type="submit" disabled={!isLoggedIn || busy}>
            发送
          </button>
        </form>
      </div>
    </article>
  );
}
