"use client";

import { excerpt, displayTitle, formatWhen } from "../lib/format";
import UserAvatar from "./UserAvatar";

export default function ArticleFeed({
  articles,
  profiles,
  selectedId,
  onSelect,
  emptyText = "暂无文章",
}) {
  if (!articles?.length) {
    return <div className="empty">{emptyText}</div>;
  }
  return (
    <div className="feed-grid">
      {articles.map((a) => {
        const author = profiles?.[a.ownerId];
        const title = displayTitle(a.title, a.body);
        return (
          <button
            key={a.id}
            type="button"
            className={`feed-card ${selectedId === a.id ? "active" : ""}`}
            onClick={() => onSelect?.(a)}
          >
            <div className="cover">
              <span style={{ position: "relative", zIndex: 1 }}>
                {a.city || "醍醐"}
              </span>
            </div>
            <div className="body">
              <div className="card-title">{title}</div>
              <div className="card-excerpt">{excerpt(a.body, 80)}</div>
              <div className="card-foot">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <UserAvatar size="sm" profile={author} />
                  {author?.displayName || "作者"}
                </span>
                <span>
                  ♥ {a.recommendCount || 0}
                  {a.listedAt ? ` · ${formatWhen(a.listedAt)}` : ""}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
