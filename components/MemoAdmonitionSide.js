"use client";

import { useEffect, useState } from "react";
import { fetchAdmonitions } from "../lib/api";
import { displayTitle, excerpt } from "../lib/format";

/** 备忘侧栏：展示已推荐谏言 */
export default function MemoAdmonitionSide() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const list = await fetchAdmonitions({ limit: 30 });
        if (alive) setNotes(Array.isArray(list) ? list : []);
      } catch (_) {
        if (alive) setNotes([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="admonition-side">
      <div className="side-section-label">谏言</div>
      <div className="admonition-side-list">
        {loading ? (
          <div className="side-hint">加载中…</div>
        ) : notes.length === 0 ? (
          <div className="side-hint">暂无谏言</div>
        ) : (
          notes.map((n) => {
            const title = (n.title || "").trim();
            const bodyText = excerpt(n.body, 120) || "";
            return (
              <div key={n.id} className="admonition-card">
                <p className="admonition-body">
                  {bodyText || displayTitle(n.title, n.body, "…", n.format)}
                </p>
                {title ? (
                  <div className="admonition-meta">— {title}</div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
