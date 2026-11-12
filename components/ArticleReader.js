"use client";

import { useEffect, useState } from "react";
import {
  addComment,
  fetchProfiles,
  fetchSocialStatus,
  listComments,
  toggleFavorite,
  toggleFollow,
  toggleRecommend,
} from "../lib/api";
import { bodyToParagraphs, displayTitle, formatWhen } from "../lib/format";
import { articleSharePath } from "../lib/site";
import { useAuth } from "./AuthProvider";
import { IconHeart, IconStar } from "./icons";
import UserAvatar from "./UserAvatar";

export default function ArticleReader({
  article,
  onNeedLogin,
  onOpenAuthor,
  toast,
}) {
  const { user, isLoggedIn } = useAuth();
  const [author, setAuthor] = useState(null);
  const [comments, setComments] = useState([]);
  const [recommended, setRecommended] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [following, setFollowing] = useState(false);
  const [recCount, setRecCount] = useState(article?.recommendCount || 0);
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);

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
    return () => {
      alive = false;
    };
  }, [article?.id, article?.ownerId, isLoggedIn, user?.id]);

  if (!article) {
    return <div className="empty">选择一篇文章开始阅读</div>;
  }

  const title = displayTitle(article.title, article.body);
  const paragraphs = bodyToParagraphs(article.body);
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
            {article.viewCount != null ? ` · ${article.viewCount} 阅读` : ""}
            {` · ${recCount} 推荐 · ${article.commentCount || comments.length} 评论`}
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
                toast?.(next ? "已关注" : "已取消关注");
              })
            }
          >
            {following ? "已关注" : "关注"}
          </button>
        ) : null}
        {onOpenAuthor ? (
          <button className="btn ghost" onClick={onOpenAuthor}>
            陋室
          </button>
        ) : null}
      </div>

      <div className="reader-body">
        {paragraphs.length ? (
          paragraphs.map((p, i) => <p key={i}>{p}</p>)
        ) : (
          <p className="sub">（正文为空）</p>
        )}
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
        <h3>评论</h3>
        {comments.length === 0 ? (
          <div className="empty" style={{ padding: "16px 0" }}>
            还没有评论
          </div>
        ) : (
          comments.map((c) => (
            <div className="comment" key={c.id}>
              <UserAvatar
                size="sm"
                name={c.authorNickname}
                profile={{
                  displayName: c.authorNickname,
                  avatarUrl: c.authorAvatarUrl,
                }}
              />
              <div>
                <div className="who">
                  {c.authorNickname || "用户"}
                  <span className="when">{formatWhen(c.createdAt)}</span>
                </div>
                <div className="text">
                  {c.replyToNickname ? `回复 ${c.replyToNickname}：` : ""}
                  {c.body}
                </div>
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
              });
              setComments((prev) => [...prev, c]);
              setCommentText("");
            });
          }}
        >
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={isLoggedIn ? "写一条评论…" : "登录后评论"}
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
