"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchListedArticles,
  fetchFollowingArticles,
  fetchMyFavorites,
  fetchMyNotes,
  fetchNotifications,
  fetchProfiles,
} from "../lib/api";
import { displayTitle, excerpt, formatWhen, snippet } from "../lib/format";
import { hasSupabase } from "../lib/supabase";
import AiChat from "./AiChat";
import ArticleFeed from "./ArticleFeed";
import ArticleReader from "./ArticleReader";
import AuthPanel from "./AuthPanel";
import { useAuth } from "./AuthProvider";
import {
  IconAi,
  IconExplore,
  IconFollow,
  IconHome,
  IconMe,
  IconSearch,
} from "./icons";
import SettingsPanel from "./SettingsPanel";
import UserAvatar from "./UserAvatar";

const NAV = [
  { id: "explore", label: "求索", Icon: IconExplore },
  { id: "hub", label: "醍醐", Icon: IconHome },
  { id: "follow", label: "关注", Icon: IconFollow },
  { id: "ai", label: "找AI", Icon: IconAi },
  { id: "me", label: "我的", Icon: IconMe },
];

const HUB_SECTIONS = [
  { id: "notes", label: "我的笔记" },
  { id: "favorites", label: "收藏" },
  { id: "notices", label: "消息" },
];

export default function AppShell({ initialArticleId = "" }) {
  const { isLoggedIn, loading: authLoading, configured, user } = useAuth();
  const [nav, setNav] = useState("explore");
  const [exploreTab, setExploreTab] = useState("market"); // market | mine
  const [hubSection, setHubSection] = useState("notes");
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState([]);
  const [mineArticles, setMineArticles] = useState([]);
  const [followArticles, setFollowArticles] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [notes, setNotes] = useState([]);
  const [notices, setNotices] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("feed"); // feed | reader | auth | author
  const [authorId, setAuthorId] = useState("");
  const [authorArticles, setAuthorArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [showListMobile, setShowListMobile] = useState(false);
  const [unread, setUnread] = useState(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2600);
  }, []);

  const loadProfilesFor = useCallback(async (list) => {
    const ids = list.map((a) => a.ownerId).filter(Boolean);
    if (!ids.length) return;
    try {
      const map = await fetchProfiles(ids);
      setProfiles((prev) => ({ ...prev, ...map }));
    } catch (_) {}
  }, []);

  const refreshExplore = useCallback(async () => {
    if (!hasSupabase()) {
      setArticles([]);
      return;
    }
    const list = await fetchListedArticles();
    setArticles(list);
    await loadProfilesFor(list);
  }, [loadProfilesFor]);

  const refreshMine = useCallback(async () => {
    if (!user?.id) {
      setMineArticles([]);
      return;
    }
    const list = await fetchListedArticles({ ownerId: user.id });
    setMineArticles(list);
    await loadProfilesFor(list);
  }, [user?.id, loadProfilesFor]);

  const refreshFollow = useCallback(async () => {
    if (!isLoggedIn) {
      setFollowArticles([]);
      return;
    }
    const list = await fetchFollowingArticles();
    setFollowArticles(list);
    await loadProfilesFor(list);
  }, [isLoggedIn, loadProfilesFor]);

  const refreshHub = useCallback(async () => {
    if (!isLoggedIn) {
      setFavorites([]);
      setNotes([]);
      setNotices([]);
      setUnread(false);
      return;
    }
    const [fav, ns, nts] = await Promise.all([
      fetchMyFavorites(),
      fetchMyNotes(),
      fetchNotifications(),
    ]);
    setFavorites(fav);
    setNotes(ns);
    setNotices(nts);
    setUnread(nts.some((n) => !n.readAt));
    await loadProfilesFor(fav);
  }, [isLoggedIn, loadProfilesFor]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await refreshExplore();
        if (initialArticleId) {
          const list = await fetchListedArticles();
          const found =
            list.find((a) => a.id === initialArticleId) ||
            (await import("../lib/api").then((m) =>
              m.fetchArticleById(initialArticleId),
            ));
          if (alive && found) {
            setSelected(found);
            setMode("reader");
            setNav("explore");
          }
        }
      } catch (e) {
        if (alive) showToast(e.message || "加载失败");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [initialArticleId, refreshExplore, showToast]);

  useEffect(() => {
    if (authLoading) return;
    refreshHub().catch(() => {});
    refreshFollow().catch(() => {});
    if (isLoggedIn) refreshMine().catch(() => {});
  }, [authLoading, isLoggedIn, refreshHub, refreshFollow, refreshMine]);

  const filterList = useCallback(
    (list) => {
      const q = query.trim().toLowerCase();
      if (!q) return list;
      return list.filter((a) => {
        const t = `${a.title || ""} ${excerpt(a.body, 200)}`.toLowerCase();
        return t.includes(q);
      });
    },
    [query],
  );

  const middleList = useMemo(() => {
    if (nav === "explore") {
      const src = exploreTab === "mine" ? mineArticles : articles;
      return filterList(src);
    }
    if (nav === "follow") return filterList(followArticles);
    if (nav === "hub" && hubSection === "favorites") return filterList(favorites);
    return [];
  }, [
    nav,
    exploreTab,
    articles,
    mineArticles,
    followArticles,
    favorites,
    hubSection,
    filterList,
  ]);

  function openArticle(a) {
    setSelected(a);
    setMode("reader");
    setShowListMobile(false);
  }

  async function openAuthor(ownerId) {
    setAuthorId(ownerId);
    setMode("author");
    try {
      const list = await fetchListedArticles({ ownerId });
      setAuthorArticles(list);
      await loadProfilesFor(list);
    } catch (e) {
      showToast(e.message || "加载陋室失败");
    }
  }

  function needLogin() {
    setNav("me");
    setMode("auth");
    showToast("请先登录");
  }

  const mainTitle = (() => {
    if (mode === "auth") return "登录";
    if (mode === "reader" && selected) return displayTitle(selected.title, selected.body);
    if (mode === "author") return profiles[authorId]?.displayName || "陋室";
    if (nav === "explore") return exploreTab === "mine" ? "陋室" : "市集";
    if (nav === "follow") return "关注动态";
    if (nav === "hub") {
      const s = HUB_SECTIONS.find((x) => x.id === hubSection);
      return s?.label || "醍醐";
    }
    if (nav === "ai") return "找 AI";
    if (nav === "me") return "我的";
    return "醍醐";
  })();

  return (
    <div className={`shell ${showListMobile ? "show-list" : ""}`}>
      <aside className="rail">
        <img className="rail-brand" src="/app_icon.png" alt="醍醐" />
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`rail-btn ${nav === id ? "active" : ""}`}
            title={label}
            onClick={() => {
              setNav(id);
              setShowListMobile(true);
              if (id === "explore") setMode("feed");
              else if (id === "follow") setMode("feed");
              else if (id === "hub") setMode("feed");
              else if (id === "ai") setMode("feed");
              else if (id === "me") setMode(isLoggedIn ? "feed" : "auth");
              if (id === "follow" && !isLoggedIn) needLogin();
              if (id === "hub" && !isLoggedIn) needLogin();
            }}
          >
            <Icon />
            {id === "hub" && unread ? <span className="rail-dot" /> : null}
          </button>
        ))}
        <div className="rail-spacer" />
        <button
          type="button"
          className="rail-btn"
          title="切换列表"
          onClick={() => setShowListMobile((v) => !v)}
        >
          <IconSearch />
        </button>
      </aside>

      <section className="middle">
        <div className="middle-head">
          <h1>{NAV.find((n) => n.id === nav)?.label || "醍醐"}</h1>
          <p className="middle-sub">
            {!configured
              ? "未配置 Supabase"
              : nav === "explore"
                ? "市集文章 · 黑白灰简约"
                : nav === "follow"
                  ? "关注的人最近上架"
                  : nav === "hub"
                    ? "笔记 · 收藏 · 消息"
                    : nav === "ai"
                      ? "对话助手"
                      : "账号与偏好"}
          </p>
          {(nav === "explore" || nav === "follow") && (
            <div className="middle-search">
              <IconSearch />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索标题或正文"
              />
            </div>
          )}
        </div>

        {nav === "explore" && isLoggedIn ? (
          <div className="tabs">
            <button
              type="button"
              className={exploreTab === "market" ? "active" : ""}
              onClick={() => {
                setExploreTab("market");
                setMode("feed");
              }}
            >
              市集
            </button>
            <button
              type="button"
              className={exploreTab === "mine" ? "active" : ""}
              onClick={() => {
                setExploreTab("mine");
                setMode("feed");
                refreshMine().catch(() => {});
              }}
            >
              陋室
            </button>
          </div>
        ) : null}

        {nav === "hub" && isLoggedIn ? (
          <div className="tabs">
            {HUB_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={hubSection === s.id ? "active" : ""}
                onClick={() => {
                  setHubSection(s.id);
                  setMode("feed");
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="middle-body">
          {nav === "ai" ? (
            <div className="empty" style={{ paddingTop: 32 }}>
              在右侧与 AI 对话。
              <br />
              记笔记、备忘请用 App。
            </div>
          ) : null}

          {nav === "me" ? (
            <div className="empty" style={{ paddingTop: 32 }}>
              {isLoggedIn ? "账号设置在右侧" : "登录后可关注、收藏与评论"}
            </div>
          ) : null}

          {nav === "hub" && isLoggedIn && hubSection === "notes" ? (
            notes.length === 0 ? (
              <div className="empty">暂无云端笔记。可在 App 中创建并同步。</div>
            ) : (
              notes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="list-item"
                  onClick={() => {
                    if (n.kind === "article" && n.listingStatus === "listed") {
                      const a = {
                        id: n.id,
                        title: n.title,
                        body: n.body,
                        format: n.format,
                        city: "",
                        listedAt: n.updatedAt,
                        ownerId: user.id,
                        viewCount: 0,
                        recommendCount: 0,
                        commentCount: 0,
                      };
                      openArticle(a);
                    } else {
                      showToast("随笔/备忘请在 App 中编辑");
                    }
                  }}
                >
                  <UserAvatar profile={{ displayName: n.kind || "笔" }} />
                  <div>
                    <div className="title">{displayTitle(n.title, n.body)}</div>
                    <div className="meta">{snippet(n.title, n.body, 40)}</div>
                  </div>
                  <div className="time">{formatWhen(n.updatedAt)}</div>
                </button>
              ))
            )
          ) : null}

          {nav === "hub" && isLoggedIn && hubSection === "notices" ? (
            notices.length === 0 ? (
              <div className="empty">暂无消息</div>
            ) : (
              notices.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="hub-row"
                  onClick={async () => {
                    if (n.noteId) {
                      try {
                        const { fetchArticleById } = await import("../lib/api");
                        const a = await fetchArticleById(n.noteId);
                        if (a) openArticle(a);
                        else showToast("文章可能已下架");
                      } catch (e) {
                        showToast(e.message || "打开失败");
                      }
                    }
                  }}
                >
                  <div className="row-top">
                    <span className="label">{n.actor?.displayName || "有人"}</span>
                    <span className="action">{formatWhen(n.createdAt)}</span>
                  </div>
                  <div className="summary">
                    {n.kind === "follow"
                      ? "关注了你"
                      : n.kind === "recommend"
                        ? "推荐了你的文章"
                        : n.body || n.kind}
                  </div>
                </button>
              ))
            )
          ) : null}

          {(nav === "explore" ||
            nav === "follow" ||
            (nav === "hub" && hubSection === "favorites")) &&
            middleList.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`list-item ${selected?.id === a.id && mode === "reader" ? "active" : ""}`}
                onClick={() => openArticle(a)}
              >
                <UserAvatar profile={profiles[a.ownerId]} />
                <div>
                  <div className="title">{displayTitle(a.title, a.body)}</div>
                  <div className="meta">{excerpt(a.body, 48)}</div>
                </div>
                <div className="time">{formatWhen(a.listedAt)}</div>
              </button>
            ))}

          {(nav === "explore" || nav === "follow") &&
          !loading &&
          middleList.length === 0 ? (
            <div className="empty">
              {nav === "follow"
                ? isLoggedIn
                  ? "还没有关注动态"
                  : "登录后查看关注"
                : exploreTab === "mine"
                  ? "陋室暂无上架文章"
                  : "市集暂无文章"}
            </div>
          ) : null}
        </div>
      </section>

      <main className="main">
        <div className="main-head">
          <h2>{mainTitle}</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {mode === "reader" || mode === "author" ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => setMode("feed")}
              >
                返回
              </button>
            ) : null}
            {!isLoggedIn && nav !== "me" ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setNav("me");
                  setMode("auth");
                }}
              >
                登录
              </button>
            ) : null}
          </div>
        </div>
        <div className="main-body">
          {loading || authLoading ? (
            <div className="loading">加载中…</div>
          ) : mode === "auth" || (nav === "me" && !isLoggedIn) ? (
            <AuthPanel
              onDone={() => {
                setMode("feed");
                setNav("explore");
                showToast("登录成功");
              }}
            />
          ) : nav === "me" && isLoggedIn && mode !== "reader" ? (
            <SettingsPanel toast={showToast} />
          ) : nav === "ai" ? (
            <AiChat onNeedLogin={needLogin} toast={showToast} />
          ) : mode === "reader" && selected ? (
            <ArticleReader
              article={selected}
              onNeedLogin={needLogin}
              onOpenAuthor={() => openAuthor(selected.ownerId)}
              toast={showToast}
            />
          ) : mode === "author" ? (
            <div>
              <div className="panel" style={{ paddingBottom: 8 }}>
                <div className="reader-meta">
                  <UserAvatar size="lg" profile={profiles[authorId]} />
                  <div>
                    <div className="name">
                      {profiles[authorId]?.displayName || "作者"}
                    </div>
                    <div className="sub">陋室 · {authorArticles.length} 篇</div>
                  </div>
                </div>
              </div>
              <ArticleFeed
                articles={authorArticles}
                profiles={profiles}
                selectedId={selected?.id}
                onSelect={openArticle}
                emptyText="此作者暂无上架文章"
              />
            </div>
          ) : nav === "hub" && hubSection === "favorites" ? (
            <ArticleFeed
              articles={filterList(favorites)}
              profiles={profiles}
              selectedId={selected?.id}
              onSelect={openArticle}
              emptyText="还没有收藏"
            />
          ) : nav === "hub" ? (
            <div className="empty">
              左侧选择笔记、收藏或消息。
              <br />
              日程与提醒请使用 App「光阴」。
            </div>
          ) : (
            <ArticleFeed
              articles={middleList}
              profiles={profiles}
              selectedId={selected?.id}
              onSelect={openArticle}
              emptyText={
                nav === "follow" ? "关注作者后，这里会出现动态" : "暂无内容"
              }
            />
          )}
        </div>
      </main>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
