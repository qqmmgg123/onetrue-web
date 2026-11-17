"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchListedArticles,
  fetchFollowingArticles,
  fetchMyFavorites,
  fetchMyNotes,
  fetchMyReads,
  fetchNotifications,
  fetchProfiles,
} from "../lib/api";
import { displayTitle, excerpt, formatWhen, snippet } from "../lib/format";
import {
  listArticleReads,
  readsToArticle,
  replaceUserArticleReadsCache,
} from "../lib/recent-reads";
import { articleSharePath } from "../lib/site";
import ArticleFeed from "./ArticleFeed";
import ArticleReader from "./ArticleReader";
import AuthPanel from "./AuthPanel";
import { useAuth } from "./AuthProvider";
import CalendarPanel from "./CalendarPanel";
import {
  IconBook,
  IconCalendar,
  IconMemo,
  IconMore,
  IconNotes,
  IconMenu,
} from "./icons";
import MemoPanel from "./MemoPanel";
import NoteEditor, { kindActionLabel, kindNoun } from "./NoteEditor";
import SettingsPanel from "./SettingsPanel";
import SupportPanel from "./SupportPanel";
import UserAvatar from "./UserAvatar";

const NAV = [
  { id: "notes", label: "笔记", Icon: IconNotes },
  { id: "memo", label: "备忘", Icon: IconMemo },
  { id: "calendar", label: "日常", Icon: IconCalendar },
  { id: "explore", label: "阅读", Icon: IconBook },
  { id: "other", label: "其他", Icon: IconMore },
];

const EXPLORE_TABS = [
  { id: "market", label: "推荐的文章" },
  { id: "follow", label: "留意的文章" },
  { id: "reads", label: "近期阅读" },
  { id: "fav", label: "收藏的文章" },
  { id: "mine", label: "我的文章" },
  { id: "inbox", label: "留言与回复" },
  { id: "publish", label: "发布文章" },
];

function isPlainNote(n) {
  return !n?.kind || n.kind === "note";
}

export default function AppShell({
  initialArticleId = "",
  initialArticle = null,
}) {
  const {
    isLoggedIn,
    loading: authLoading,
    user,
    authExpiredTick,
  } = useAuth();
  const [nav, setNav] = useState("explore");
  const [exploreTab, setExploreTab] = useState("market");
  const [otherTab, setOtherTab] = useState("settings");
  const [query] = useState("");
  const [articles, setArticles] = useState([]);
  const [mineArticles, setMineArticles] = useState([]);
  const [followArticles, setFollowArticles] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [notes, setNotes] = useState([]);
  const [notesHasMore, setNotesHasMore] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesLoadingMore, setNotesLoadingMore] = useState(false);
  const notesOffsetRef = useRef(0);
  const notesBusyRef = useRef(false);
  const notesHasMoreRef = useRef(false);
  const [hubLoading, setHubLoading] = useState(false);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [notices, setNotices] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [selected, setSelected] = useState(
    initialArticle?.id ? initialArticle : null,
  );
  const [mode, setMode] = useState(
    initialArticleId || initialArticle?.id ? "reader" : "feed",
  );
  // feed | reader | auth | author | compose | settings
  const [authorId, setAuthorId] = useState("");
  const [authorArticles, setAuthorArticles] = useState([]);
  const [loading, setLoading] = useState(!(initialArticle?.id));
  const [toast, setToast] = useState("");
  const [composeScheduleAt, setComposeScheduleAt] = useState(null);
  const [composeRemindAt, setComposeRemindAt] = useState(null);
  const [composeKind, setComposeKind] = useState(null);
  const [composeNote, setComposeNote] = useState(null);
  const [recentReads, setRecentReads] = useState([]);
  const [highlightCommentId, setHighlightCommentId] = useState("");
  const [narrow, setNarrow] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [leaveDlg, setLeaveDlg] = useState(null);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const composeGuardRef = useRef(null);
  const wasGuestRef = useRef(null);
  const skipDefaultNavRef = useRef(Boolean(initialArticleId));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(max-width: 860px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!narrow) setRailOpen(false);
  }, [narrow]);

  useEffect(() => {
    if (mode !== "compose") return undefined;
    const onBeforeUnload = (e) => {
      if (composeGuardRef.current?.isDirty?.()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [mode]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2600);
  }, []);

  const refreshReads = useCallback(async () => {
    const uid = isLoggedIn ? user?.id || "" : "";
    if (!uid) {
      setRecentReads([]);
      return;
    }
    try {
      const cloud = await fetchMyReads();
      replaceUserArticleReadsCache(uid, cloud);
    } catch (_) {
      /* 离线时用本机用户缓存 */
    }
    const list = listArticleReads({ userId: uid });
    setRecentReads(list);
    const ids = list.map((r) => r.ownerId).filter(Boolean);
    if (ids.length) {
      fetchProfiles(ids)
        .then((map) => setProfiles((prev) => ({ ...prev, ...map })))
        .catch(() => {});
    }
  }, [isLoggedIn, user?.id]);

  const loadProfilesFor = useCallback(async (list) => {
    const ids = list.map((a) => a.ownerId).filter(Boolean);
    if (!ids.length) return;
    try {
      const map = await fetchProfiles(ids);
      setProfiles((prev) => ({ ...prev, ...map }));
    } catch (_) {}
  }, []);

  const refreshExplore = useCallback(async () => {
    setExploreLoading(true);
    try {
      const list = await fetchListedArticles();
      setArticles(list);
      await loadProfilesFor(list);
    } finally {
      setExploreLoading(false);
    }
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

  const loadNotesPage = useCallback(async ({ reset = false } = {}) => {
    if (!isLoggedIn) {
      setNotes([]);
      setNotesHasMore(false);
      notesHasMoreRef.current = false;
      notesOffsetRef.current = 0;
      return;
    }
    if (notesBusyRef.current) return;
    if (!reset && !notesHasMoreRef.current) return;
    notesBusyRef.current = true;
    if (reset) setNotesLoading(true);
    else setNotesLoadingMore(true);
    try {
      const offset = reset ? 0 : notesOffsetRef.current;
      const page = await fetchMyNotes({ limit: 40, offset });
      const batch = page?.notes || (Array.isArray(page) ? page : []);
      const hasMore =
        page && typeof page === "object" && !Array.isArray(page)
          ? Boolean(page.hasMore)
          : batch.length >= 40;
      setNotes((prev) => {
        if (reset) return batch;
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...batch.filter((n) => n?.id && !seen.has(n.id))];
      });
      notesOffsetRef.current = offset + batch.length;
      notesHasMoreRef.current = hasMore;
      setNotesHasMore(hasMore);
    } finally {
      notesBusyRef.current = false;
      setNotesLoading(false);
      setNotesLoadingMore(false);
    }
  }, [isLoggedIn]);

  const refreshHub = useCallback(async () => {
    if (!isLoggedIn) {
      setFavorites([]);
      setNotes([]);
      setNotices([]);
      setNotesHasMore(false);
      notesOffsetRef.current = 0;
      setHubLoading(false);
      return;
    }
    setHubLoading(true);
    try {
      const [fav, nts] = await Promise.all([
        fetchMyFavorites(),
        fetchNotifications(),
      ]);
      setFavorites(fav);
      setNotices(nts);
      await loadProfilesFor(fav);
      await loadNotesPage({ reset: true });
    } finally {
      setHubLoading(false);
    }
  }, [isLoggedIn, loadProfilesFor, loadNotesPage]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!initialArticle?.id) setLoading(true);
      try {
        await refreshExplore();
        const aid = initialArticleId || initialArticle?.id || "";
        if (aid) {
          skipDefaultNavRef.current = true;
          setNav("explore");
          setExploreTab("market");
          let found = initialArticle?.id === aid ? initialArticle : null;
          if (!found) {
            try {
              found = await fetchListedArticles().then((list) =>
                list.find((a) => a.id === aid),
              );
            } catch (_) {}
          }
          if (alive && found) {
            setSelected(found);
            setMode("reader");
            const path = articleSharePath(found.id);
            if (
              typeof window !== "undefined" &&
              window.location.pathname !== path
            ) {
              window.history.replaceState(
                { articleId: found.id },
                "",
                path,
              );
            }
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
  }, [initialArticleId, initialArticle, refreshExplore, showToast]);

  // 浏览器前进/后退同步文章路由
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onPop = () => {
      const m = window.location.pathname.match(/^\/a\/([^/]+)\/?$/);
      if (m?.[1]) {
        const id = decodeURIComponent(m[1]);
        const fromLists = [
          ...articles,
          ...mineArticles,
          ...followArticles,
          ...favorites,
          ...recentReads.map(readsToArticle).filter(Boolean),
        ];
        const found =
          fromLists.find((a) => a?.id === id) ||
          (selected?.id === id ? selected : null);
        if (found) {
          setSelected(found);
          setMode("reader");
          setNav("explore");
          return;
        }
        fetchListedArticles()
          .then((list) => {
            const a = list.find((x) => x.id === id);
            if (a) {
              setSelected(a);
              setMode("reader");
              setNav("explore");
            }
          })
          .catch(() => {});
        return;
      }
      if (mode === "reader" || mode === "author") {
        setMode("feed");
        setSelected(null);
        setHighlightCommentId("");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [
    articles,
    mineArticles,
    followArticles,
    favorites,
    recentReads,
    selected,
    mode,
  ]);

  useEffect(() => {
    if (authLoading) return;
    const guest = !isLoggedIn;
    if (wasGuestRef.current == null) {
      wasGuestRef.current = guest;
      if (!skipDefaultNavRef.current) {
        setNav(guest ? "explore" : "notes");
        if (!guest) {
          setMode("compose");
          setComposeKind("note");
          setComposeNote(null);
        }
      }
    } else if (wasGuestRef.current !== guest) {
      wasGuestRef.current = guest;
      setNav(guest ? "explore" : "notes");
      setMode(guest ? "feed" : "compose");
      setExploreTab("market");
      if (!guest) {
        setComposeKind("note");
        setComposeNote(null);
      } else {
        clearCompose();
      }
    }
    refreshHub().catch(() => {});
    refreshFollow().catch(() => {});
    if (isLoggedIn) refreshMine().catch(() => {});
    refreshReads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authLoading,
    isLoggedIn,
    refreshHub,
    refreshFollow,
    refreshMine,
    refreshReads,
  ]);

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

  const noteList = useMemo(
    () =>
      notes
        .filter(isPlainNote)
        .slice()
        .sort((a, b) =>
          String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
        ),
    [notes],
  );

  const scheduleNotes = useMemo(
    () => notes.filter((n) => n.kind === "schedule"),
    [notes],
  );

  function clearCompose() {
    setComposeScheduleAt(null);
    setComposeRemindAt(null);
    setComposeKind(null);
    setComposeNote(null);
  }

  function leaveComposeThen(run) {
    if (mode !== "compose") {
      run();
      return;
    }
    if (!composeGuardRef.current?.isDirty?.()) {
      clearCompose();
      run();
      return;
    }
    const k =
      composeGuardRef.current?.getKind?.() ||
      composeKind ||
      composeNote?.kind ||
      "note";
    setLeaveDlg({ run, kind: k });
  }

  function openCompose(note = null, extras = {}) {
    const enter = () => {
      if (!isLoggedIn) {
        needLogin();
        return;
      }
      setComposeNote(note || null);
      setComposeScheduleAt(extras.scheduleAt ?? null);
      setComposeRemindAt(extras.remindAt ?? null);
      setComposeKind(extras.kind ?? note?.kind ?? null);
      setMode("compose");
    };
    if (mode === "compose") leaveComposeThen(enter);
    else enter();
  }

  function afterNoteSaved(note) {
    if (note?.kind === "memo") {
      clearCompose();
      setMode("feed");
      setNav("memo");
      return;
    }
    if (note?.kind === "schedule") {
      clearCompose();
      setMode("feed");
      setNav("calendar");
      return;
    }
    if (note?.kind === "article") {
      clearCompose();
      setNav("explore");
      setExploreTab("mine");
      setMode("feed");
      refreshMine().catch(() => {});
      return;
    }
    // 笔记：留在编辑页
    setComposeNote(note || null);
    setComposeKind("note");
    setComposeScheduleAt(null);
    setComposeRemindAt(null);
    setNav("notes");
    setMode("compose");
  }

  function syncArticleUrl(articleId) {
    if (typeof window === "undefined") return;
    const path = articleId ? articleSharePath(articleId) : "/";
    if (window.location.pathname === path) return;
    window.history.pushState(
      articleId ? { articleId } : {},
      "",
      path,
    );
  }

  function openArticle(a, opts = {}) {
    leaveComposeThen(() => {
      setSelected(a);
      setHighlightCommentId(opts.highlightCommentId || "");
      setMode("reader");
      setNav("explore");
      if (a?.id) syncArticleUrl(a.id);
    });
  }

  function closeReader() {
    setMode("feed");
    setSelected(null);
    setHighlightCommentId("");
    syncArticleUrl("");
  }

  function openAuthor(ownerId) {
    leaveComposeThen(async () => {
      setAuthorId(ownerId);
      setMode("author");
      try {
        const list = await fetchListedArticles({ ownerId });
        setAuthorArticles(list);
        await loadProfilesFor(list);
      } catch (e) {
        showToast(e.message || "加载失败");
      }
    });
  }

  function needLogin(msg = "请先登录") {
    leaveComposeThen(() => {
      setNav("other");
      setOtherTab("settings");
      setMode("auth");
      showToast(msg);
    });
  }

  useEffect(() => {
    if (!authExpiredTick) return;
    needLogin("登录已过期，请重新登录");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authExpiredTick]);

  function goNav(id) {
    setRailOpen(false);
    const go = () => {
      if (id === "other") {
        setNav("other");
        setOtherTab("settings");
        setMode(isLoggedIn ? "settings" : "auth");
        clearCompose();
        return;
      }
      if (id === "notes") {
        setNav("notes");
        if (!isLoggedIn) {
          clearCompose();
          setMode("feed");
          return;
        }
        setComposeNote(null);
        setComposeKind("note");
        setComposeScheduleAt(null);
        setComposeRemindAt(null);
        setMode("compose");
        refreshHub().catch(() => {});
        return;
      }
      if (id === "memo") {
        setNav("memo");
        clearCompose();
        setMode("feed");
        refreshHub().catch(() => {});
        return;
      }
      if (id === "calendar") {
        setNav("calendar");
        clearCompose();
        setMode("feed");
        if (isLoggedIn) refreshHub().catch(() => {});
        return;
      }
      if (id === "explore") {
        setNav("explore");
        clearCompose();
        setMode("feed");
        setExploreTab("market");
        return;
      }
      setNav(id);
      setMode("feed");
    };
    if (mode === "compose") leaveComposeThen(go);
    else go();
  }

  function openExploreTab(tabId) {
    leaveComposeThen(() => {
      if (tabId === "publish") {
        if (!isLoggedIn) return needLogin();
        setNav("explore");
        setExploreTab("mine");
        openCompose(null, { kind: "article" });
        return;
      }
      const needsAuth = tabId !== "market";
      if (needsAuth && !isLoggedIn) return needLogin();
      setNav("explore");
      setExploreTab(tabId);
      setMode("feed");
      setSelected(null);
      setHighlightCommentId("");
      setRailOpen(false);
      if (tabId === "follow") refreshFollow().catch(() => {});
      if (tabId === "fav" || tabId === "inbox") refreshHub().catch(() => {});
      if (tabId === "reads") refreshReads();
      if (tabId === "mine") refreshMine().catch(() => {});
    });
  }

  // 备忘 / 日常无二级侧栏内容：隐藏中间列，主区铺满
  const hideMiddle = nav === "memo" || nav === "calendar";

  const shellClass = [
    "shell",
    narrow ? "is-narrow" : "",
    railOpen ? "rail-open" : "",
    hideMiddle ? "no-middle" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const menuBtn = (
    <button
      type="button"
      className="mobile-menu-btn"
      aria-label={railOpen ? "收起菜单" : "打开菜单"}
      onClick={() => setRailOpen((v) => !v)}
    >
      <IconMenu />
    </button>
  );

  const mainTitle = (() => {
    if (mode === "compose") {
      const k = composeKind || composeNote?.kind || "note";
      return composeNote?.id ? `编辑${kindNoun(k)}` : `新${kindNoun(k)}`;
    }
    if (mode === "auth") return "登录";
    if (mode === "settings" || (nav === "other" && otherTab === "settings"))
      return "账号和设置";
    if (nav === "other" && otherTab === "support") return "客服和联系";
    if (mode === "reader" && selected)
      return displayTitle(selected.title, selected.body);
    if (mode === "author") return profiles[authorId]?.displayName || "作者";
    if (nav === "explore") {
      return (
        EXPLORE_TABS.find((t) => t.id === exploreTab)?.label || "阅读"
      );
    }
    if (nav === "calendar") return "日常";
    if (nav === "notes") return "笔记";
    if (nav === "memo") return "备忘";
    return NAV.find((n) => n.id === nav)?.label || "醍醐";
  })();

  const leaveKind = leaveDlg?.kind || "note";

  function renderExploreMain() {
    if (!isLoggedIn && exploreTab !== "market") {
      return (
        <div className="empty login-cta">
          <p>登录后可查看此内容</p>
          <button type="button" className="btn" onClick={() => needLogin()}>
            登录
          </button>
        </div>
      );
    }
    if (
      (exploreTab === "market" && (loading || exploreLoading)) ||
      (exploreTab === "fav" && hubLoading) ||
      (exploreTab === "inbox" && hubLoading) ||
      (exploreTab === "mine" && exploreLoading) ||
      (exploreTab === "follow" && exploreLoading)
    ) {
      return <div className="panel-loading">加载中…</div>;
    }
    if (exploreTab === "reads") {
      return (
        <div className="hub-main-list">
          {recentReads.length === 0 ? (
            <div className="empty">还没有阅读记录。去「推荐的文章」点开后会出现在这里。</div>
          ) : (
            recentReads.map((r) => (
              <button
                key={r.id}
                type="button"
                className="list-item"
                onClick={() => {
                  const a = readsToArticle(r);
                  if (a) openArticle(a);
                }}
              >
                <UserAvatar
                  profile={profiles[r.ownerId] || { displayName: "读" }}
                />
                <div>
                  <div className="title">
                    {displayTitle(r.title, r.body)}
                  </div>
                  <div className="meta">{snippet(r.title, r.body, 40)}</div>
                </div>
                <div className="time">{formatWhen(r.lastReadAt)}</div>
              </button>
            ))
          )}
        </div>
      );
    }
    if (exploreTab === "fav") {
      return (
        <ArticleFeed
          articles={filterList(favorites)}
          profiles={profiles}
          selectedId={selected?.id}
          onSelect={openArticle}
          emptyText="还没有收藏"
        />
      );
    }
    if (exploreTab === "follow") {
      return (
        <ArticleFeed
          articles={filterList(followArticles)}
          profiles={profiles}
          selectedId={selected?.id}
          onSelect={openArticle}
          emptyText="留意作者后，这里会出现动态"
        />
      );
    }
    if (exploreTab === "inbox") {
      return (
        <div className="hub-main-list">
          {notices.length === 0 ? (
            <div className="empty">暂无留言或回复</div>
          ) : (
            notices.map((n) => (
              <button
                key={n.id}
                type="button"
                className="hub-row"
                onClick={async () => {
                  if (!n.noteId) return;
                  try {
                    const list = await fetchListedArticles();
                    const a = list.find((x) => x.id === n.noteId);
                    if (a) {
                      openArticle(a, {
                        highlightCommentId: n.commentId || "",
                      });
                    } else showToast("文章可能已删除");
                  } catch (e) {
                    showToast(e.message || "打开失败");
                  }
                }}
              >
                <div className="row-top">
                  <span className="label">
                    {n.actor?.displayName || "有人"}
                  </span>
                  <span className="action">{formatWhen(n.createdAt)}</span>
                </div>
                <div className="summary">
                  {n.kind === "follow"
                    ? "留意了你"
                    : n.kind === "recommend"
                      ? "推荐了你的文章"
                      : n.kind === "reply"
                        ? "回复了你"
                        : n.kind === "comment"
                          ? "留言了你的文章"
                          : n.body || n.kind}
                </div>
              </button>
            ))
          )}
        </div>
      );
    }
    if (exploreTab === "mine") {
      return (
        <ArticleFeed
          articles={filterList(mineArticles)}
          profiles={profiles}
          selectedId={selected?.id}
          onSelect={openArticle}
          emptyText="还没有文章，点左侧「发布文章」写一篇"
        />
      );
    }
    return (
      <ArticleFeed
        articles={filterList(articles)}
        profiles={profiles}
        selectedId={selected?.id}
        onSelect={openArticle}
        emptyText="暂无推荐文章"
      />
    );
  }

  return (
    <div className={shellClass}>
      <button
        type="button"
        className="rail-backdrop"
        aria-label="关闭菜单"
        onClick={() => setRailOpen(false)}
      />
      <aside className="rail">
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`rail-btn ${nav === id ? "active" : ""}`}
            title={label}
            onClick={() => goNav(id)}
          >
            <Icon filled={nav === id} />
            <span className="rail-label">{label}</span>
          </button>
        ))}
        <div className="rail-spacer" />
      </aside>

      <section className="middle">
        <div className="middle-head">
          {menuBtn}
          <div className="middle-head-text">
            <h1>{NAV.find((n) => n.id === nav)?.label || "醍醐"}</h1>
            <p className="middle-sub">
              {nav === "notes"
                ? "随笔列表"
                : nav === "memo"
                  ? "备忘卡片"
                  : nav === "calendar"
                    ? "周历"
                    : nav === "explore"
                      ? "推荐 · 留意 · 收藏"
                      : "账号与反馈"}
            </p>
          </div>
        </div>

        <div
          className="middle-body"
          onScroll={(e) => {
            if (nav !== "notes" || !isLoggedIn) return;
            if (!notesHasMore || notesLoadingMore || notesLoading) return;
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 96) {
              loadNotesPage({ reset: false });
            }
          }}
        >
          {nav === "notes" ? (
            <>
              <HubRow
                title="＋ 新笔记"
                summary="写一篇新的笔记"
                action="写"
                active={
                  mode === "compose" &&
                  !composeNote?.id &&
                  (composeKind === "note" || !composeKind)
                }
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  openCompose(null, { kind: "note" });
                }}
              />
              {authLoading || (isLoggedIn && (hubLoading || notesLoading)) ? (
                <div className="middle-loading">加载笔记中…</div>
              ) : !isLoggedIn ? (
                <div className="empty" style={{ padding: 16 }}>
                  登录后查看笔记列表
                </div>
              ) : (
                <>
                  {noteList.map((n) => (
                    <HubRow
                      key={n.id}
                      title={displayTitle(n.title, n.body, "无标题", n.format)}
                      summary={formatWhen(n.updatedAt)}
                      action="打开"
                      active={mode === "compose" && composeNote?.id === n.id}
                      onClick={() => openCompose(n)}
                    />
                  ))}
                  {noteList.length === 0 ? (
                    <div className="empty" style={{ padding: 16 }}>
                      还没有笔记
                    </div>
                  ) : null}
                  {notesLoadingMore ? (
                    <div className="middle-load-more">加载更多…</div>
                  ) : null}
                  {!notesLoadingMore && notesHasMore && noteList.length > 0 ? (
                    <button
                      type="button"
                      className="middle-load-more"
                      style={{ width: "100%", border: 0, background: "transparent" }}
                      onClick={() => loadNotesPage({ reset: false })}
                    >
                      下拉或点击加载更多
                    </button>
                  ) : null}
                </>
              )}
            </>
          ) : null}


          {nav === "explore" ? (
            <>
              {EXPLORE_TABS.map((t) => (
                <HubRow
                  key={t.id}
                  title={t.id === "publish" ? "＋ 发布文章" : t.label}
                  summary={
                    t.id === "publish"
                      ? "写一篇文章"
                      : t.id === "market"
                        ? "浏览推荐"
                        : t.id === "follow"
                          ? "留意的人更新"
                          : t.id === "reads"
                            ? "最近读过的"
                            : t.id === "fav"
                              ? "收藏过的文章"
                              : t.id === "mine"
                                ? "我写的文章"
                                : "留言与回复"
                  }
                  action={t.id === "publish" ? "写" : "打开"}
                  active={
                    t.id === "publish"
                      ? mode === "compose" && composeKind === "article"
                      : exploreTab === t.id &&
                        (mode === "feed" ||
                          mode === "reader" ||
                          mode === "author")
                  }
                  onClick={() => openExploreTab(t.id)}
                />
              ))}
            </>
          ) : null}

          {nav === "other" ? (
            <>
              <HubRow
                title="账号和设置"
                summary="昵称、头像与退出"
                action="打开"
                active={
                  otherTab === "settings" &&
                  (mode === "settings" || mode === "auth")
                }
                onClick={() => {
                  leaveComposeThen(() => {
                    setOtherTab("settings");
                    setMode(isLoggedIn ? "settings" : "auth");
                    setNav("other");
                  });
                }}
              />
              <HubRow
                title="联系与反馈"
                summary="联系方式与意见反馈"
                action="打开"
                active={otherTab === "support" && mode === "feed"}
                onClick={() => {
                  leaveComposeThen(() => {
                    setOtherTab("support");
                    setMode("feed");
                    setNav("other");
                  });
                }}
              />
            </>
          ) : null}
        </div>
      </section>

      <main className="main">
        <div className="main-head">
          <div className="main-head-left">
            {menuBtn}
            <h2>{mainTitle}</h2>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {mode === "reader" || mode === "author" ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  if (mode === "author") {
                    setMode(selected ? "reader" : "feed");
                    if (!selected) syncArticleUrl("");
                    return;
                  }
                  closeReader();
                }}
              >
                返回
              </button>
            ) : null}
            {!isLoggedIn && nav !== "other" ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setNav("other");
                  setMode("auth");
                }}
              >
                登录
              </button>
            ) : null}
          </div>
          {narrow && nav === "explore" && mode !== "compose" ? (
            <div className="mobile-tabs" role="tablist">
              {EXPLORE_TABS.filter((t) => t.id !== "publish").map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  className={`mobile-tab${exploreTab === t.id && mode === "feed" ? " active" : ""}`}
                  onClick={() => openExploreTab(t.id)}
                >
                  {t.label.replace(/的文章$/, "").replace(/与回复$/, "")}
                </button>
              ))}
            </div>
          ) : null}
          {narrow && nav === "other" ? (
            <div className="mobile-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={`mobile-tab${otherTab === "settings" ? " active" : ""}`}
                onClick={() => {
                  setOtherTab("settings");
                  setMode(isLoggedIn ? "settings" : "auth");
                }}
              >
                账号和设置
              </button>
              <button
                type="button"
                role="tab"
                className={`mobile-tab${otherTab === "support" ? " active" : ""}`}
                onClick={() => {
                  setOtherTab("support");
                  setMode("feed");
                }}
              >
                联系与反馈
              </button>
            </div>
          ) : null}
        </div>
        <div
          className={`main-body${mode === "compose" ? " main-body-flush" : ""}`}
        >
          {loading || authLoading ? (
            <div className="loading">加载中…</div>
          ) : mode === "compose" ? (
            <NoteEditor
              ref={composeGuardRef}
              key={
                composeNote?.id ||
                `new:${composeKind || "note"}:${composeScheduleAt || ""}`
              }
              note={composeNote}
              toast={showToast}
              initialScheduleAt={composeScheduleAt}
              initialRemindAt={composeRemindAt}
              initialKind={composeKind}
              onCreated={async (note) => {
                await refreshHub().catch(() => {});
                await refreshExplore().catch(() => {});
                await refreshMine().catch(() => {});
                afterNoteSaved(note);
              }}
              onSaved={async (note) => {
                await refreshHub().catch(() => {});
                await refreshExplore().catch(() => {});
                await refreshMine().catch(() => {});
                afterNoteSaved(note);
              }}
            />
          ) : mode === "auth" ? (
            <AuthPanel
              onDone={() => {
                showToast("登录成功");
                // 登录默认落到笔记（wasGuest sync）
              }}
            />
          ) : nav === "other" && otherTab === "support" && mode === "feed" ? (
            <SupportPanel toast={showToast} />
          ) : mode === "settings" ||
            (nav === "other" && otherTab === "settings" && isLoggedIn) ? (
            <SettingsPanel toast={showToast} />
          ) : mode === "reader" && selected ? (
            <ArticleReader
              article={selected}
              highlightCommentId={highlightCommentId}
              onNeedLogin={needLogin}
              onOpenAuthor={() => openAuthor(selected.ownerId)}
              onReadRecorded={refreshReads}
              onEdit={() => {
                if (!selected) return;
                openCompose({
                  id: selected.id,
                  title: selected.title,
                  body: selected.body,
                  format: selected.format || "quill",
                  kind: selected.kind || "article",
                  listingStatus: selected.listingStatus || "listed",
                  city: selected.city || "",
                  listedAt: selected.listedAt,
                  updatedAt: selected.updatedAt,
                  scheduleAt: selected.scheduleAt || null,
                  remindAt: selected.remindAt || null,
                  ownerId: selected.ownerId,
                  recurFreq: selected.recurFreq,
                  recurByday: selected.recurByday,
                  recurUntil: selected.recurUntil,
                  recurCount: selected.recurCount,
                  remindOffsetMin: selected.remindOffsetMin,
                });
              }}
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
                    <div className="sub">{authorArticles.length} 篇</div>
                  </div>
                </div>
              </div>
              <ArticleFeed
                articles={authorArticles}
                profiles={profiles}
                selectedId={selected?.id}
                onSelect={openArticle}
                emptyText="此作者暂无文章"
              />
            </div>
          ) : nav === "notes" ? (
            !isLoggedIn ? (
              <div className="empty login-cta">
                <p>登录后开始写笔记</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => needLogin()}
                >
                  去登录
                </button>
              </div>
            ) : (
              <div className="empty">从左侧点「＋ 新笔记」或打开一篇笔记</div>
            )
          ) : nav === "memo" ? (
            <MemoPanel
              notes={notes}
              loading={authLoading || hubLoading || notesLoading}
              isLoggedIn={isLoggedIn}
              onNeedLogin={needLogin}
              onCompose={(extras) => openCompose(null, extras)}
              onEdit={(n) => openCompose(n)}
              onChanged={() => refreshHub().catch(() => {})}
              toast={showToast}
            />
          ) : nav === "calendar" ? (
            <CalendarPanel
              notes={scheduleNotes}
              view="week"
              onOpenNote={(n) => openCompose(n)}
              onCreateSchedule={(at) => {
                if (!isLoggedIn) return needLogin();
                const iso = at instanceof Date ? at.toISOString() : at;
                openCompose(null, {
                  scheduleAt: iso,
                  kind: "schedule",
                });
              }}
            />
          ) : nav === "explore" ? (
            renderExploreMain()
          ) : (
            <div className="empty">从左侧选择入口</div>
          )}
        </div>
      </main>

      {toast ? <div className="toast">{toast}</div> : null}

      {leaveDlg ? (
        <div className="leave-dialog-backdrop" role="presentation">
          <div
            className="leave-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-dialog-title"
          >
            <h3 id="leave-dialog-title">内容可能丢失</h3>
            <p style={{ whiteSpace: "pre-line" }}>
              {`离开当前${kindNoun(leaveKind)}可能丢失\n是否${kindActionLabel(leaveKind)}？`}
            </p>
            <div className="leave-dialog-actions">
              <button
                type="button"
                className="btn"
                disabled={leaveBusy}
                onClick={async () => {
                  setLeaveBusy(true);
                  try {
                    await composeGuardRef.current?.save?.();
                    await refreshHub().catch(() => {});
                    await refreshExplore().catch(() => {});
                    await refreshMine().catch(() => {});
                    const run = leaveDlg.run;
                    setLeaveDlg(null);
                    clearCompose();
                    run();
                  } catch (_) {
                    /* toast 已在编辑器内 */
                  } finally {
                    setLeaveBusy(false);
                  }
                }}
              >
                {leaveBusy ? "处理中…" : "是"}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={leaveBusy}
                onClick={() => {
                  const run = leaveDlg.run;
                  setLeaveDlg(null);
                  clearCompose();
                  run();
                }}
              >
                否
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={leaveBusy}
                onClick={() => setLeaveDlg(null)}
              >
                返回
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HubRow({ title, summary, action, onClick, active = false }) {
  return (
    <button
      type="button"
      className={`hub-row${active ? " active" : ""}`}
      onClick={onClick}
    >
      <div className="row-top">
        <span className="label">{title}</span>
        <span className="action">{action} ›</span>
      </div>
      <div className="summary">{summary}</div>
    </button>
  );
}
