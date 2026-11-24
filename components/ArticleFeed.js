"use client";

import { excerpt, displayTitle, formatWhen } from "../lib/format";
import { mediaDisplayUrl } from "../lib/media-url";
import UserAvatar from "./UserAvatar";

export default function ArticleFeed({
  articles,
  profiles,
  selectedId,
  onSelect,
  onRemove,
  removeTitle = "移除",
  emptyText = "暂无文章",
  footTimeOf,
}) {
  if (!articles?.length) {
    return <div className="empty">{emptyText}</div>;
  }
  return (
    <div className="feed-grid">
      {articles.map((a) => {
        const author = profiles?.[a.ownerId];
        const title = displayTitle(a.title, a.body);
        const cover = String(a.coverUrl || "").trim();
        const footTime = footTimeOf?.(a) || a.listedAt;
        return (
          <div
            key={a.id}
            className={`feed-card ${selectedId === a.id ? "active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelect?.(a)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(a);
              }
            }}
          >
            <div className={`cover${cover ? " has-image" : ""}`}>
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaDisplayUrl(cover)}
                  alt=""
                  className="cover-img"
                />
              ) : null}
              <span className="cover-city">{a.city || "醍醐"}</span>
              {onRemove ? (
                <button
                  type="button"
                  className="feed-remove"
                  title={removeTitle}
                  aria-label={removeTitle}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(a);
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
            <div className="body">
              <div className="card-title">{title}</div>
              <div className="card-excerpt">{excerpt(a.body, 80)}</div>
              <div className="card-foot">
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <UserAvatar size="sm" profile={author} />
                  {author?.displayName || "作者"}
                </span>
                <span>
                  ♥ {a.recommendCount || 0}
                  {footTime ? ` · ${formatWhen(footTime)}` : ""}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
