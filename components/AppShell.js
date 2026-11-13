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
import {
  createChatSession,
  deleteChatSession,
  listChatSessions,
} from "../lib/chat-store";
import { displayTitle, excerpt, formatWhen, snippet } from "../lib/format";
import { listArticleReads, readsToArticle } from "../lib/recent-reads";
import AiChat from "./AiChat";
import ArticleFeed from "./ArticleFeed";
import ArticleReader from "./ArticleReader";
import AuthPanel from "./AuthPanel";
import { useAuth } from "./AuthProvider";
import CalendarPanel from "./CalendarPanel";
import {
  IconCalendar,
  IconMore,
  IconTihu,
  IconExplore,
  IconEdit,
  IconMenu,
} from "./icons";
import NoteEditor from "./NoteEditor";
import SettingsPanel from "./SettingsPanel";
import SupportPanel from "./SupportPanel";
import UserAvatar from "./UserAvatar";

const NAV = [
  { id: "tihu", label: "醍醐", Icon: IconTihu },
  { id: "calendar", label: "光阴", Icon: IconCalendar },
  { id: "explore", label: "求索", Icon: IconExplore },
  { id: "act", label: "作为", Icon: IconEdit },
  { id: "other", label: "其他", Icon: IconMore },
];

export default function AppShell({ initialArticleId = "" }) {
  const {
    isLoggedIn,
    loading: authLoading,
    user,
    authExpiredTick,
  } = useAuth();
  const [nav, setNav] = useState("tihu");
  const [exploreTab, setExploreTab] = useState("market");
  const [hubView, setHubView] = useState("todos"); // home | todos | notes | reads | fav | follow | inbox
  const [calendarView, setCalendarView] = useState("week"); // week | month
  const [otherTab, setOtherTab] = useState("settings"); // settings | support
  const [query] = useState("");
  const [articles, setArticles] = useState([]);
  const [mineArticles, setMineArticles] = useState([]);
  const [followArticles, setFollowArticles] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [notes, setNotes] = useState([]);
  const [notices, setNotices] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("feed");
  // feed | reader | auth | author | compose | ai | act-sheet | settings
  const [authorId, setAuthorId] = useState("");
  const [authorArticles, setAuthorArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [chatId, setChatId] = useState("");
  const [chatList, setChatList] = useState([]);
  const [composeScheduleAt, setComposeScheduleAt] = useState(null);
  const [composeRemindAt, setComposeRemindAt] = useState(null);
  const [composeKind, setComposeKind] = useState(null);
  const [composeNote, setComposeNote] = useState(null);
  const [recentReads, setRecentReads] = useState([]);
  const [highlightCommentId, setHighlightCommentId] = useState("");
  const [narrow, setNarrow] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

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

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2600);
  }, []);

  const refreshChats = useCallback(() => {
    setChatList(listChatSessions());
  }, []);

  const refreshReads = useCallback(() => {
    const list = listArticleReads();
    setRecentReads(list);
    const ids = list.map((r) => r.ownerId).filter(Boolean);
    if (ids.length) {
      fetchProfiles(ids)
        .then((map) => setProfiles((prev) => ({ ...prev, ...map })))
        .catch(() => {});
    }
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
          const found = list.find((a) => a.id === initialArticleId);
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
    refreshChats();
    refreshReads();
  }, [
    authLoading,
    isLoggedIn,
    refreshHub,
    refreshFollow,
    refreshMine,
    refreshChats,
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

  const todos = useMemo(
    () =>
      notes.filter(
        (n) => n.kind === "memo" || n.kind === "schedule",
      ),
    [notes],
  );

  const todoPreview = todos[0] || null;
  const latestNote = notes[0] || null;
  // 只用 state，避免首屏读 localStorage 与 SSR 文字不一致（hydration error）
  const latestRead = recentReads[0] || null;

  function clearCompose() {
    setComposeScheduleAt(null);
    setComposeRemindAt(null);
    setComposeKind(null);
    setComposeNote(null);
  }

  function openCompose(note = null, extras = {}) {
    if (!isLoggedIn) {
      needLogin();
      return;
    }
    setComposeNote(note || null);
    setComposeScheduleAt(extras.scheduleAt ?? null);
    setComposeRemindAt(extras.remindAt ?? null);
    setComposeKind(extras.kind ?? note?.kind ?? null);
    setMode("compose");
  }

  function afterNoteSaved(note) {
    clearCompose();
    if (note?.listingStatus === "listed") {
      openArticle({
        id: note.id,
        title: note.title,
        body: note.body,
        format: note.format,
        city: note.city || "",
        listedAt: note.listedAt || note.updatedAt,
        ownerId: note.ownerId || user?.id || "",
        viewCount: 0,
        recommendCount: 0,
        commentCount: 0,
      });
      setNav("explore");
      return;
    }
    if (note?.kind === "schedule" || note?.kind === "memo") {
      setMode("feed");
      setNav("calendar");
      return;
    }
    setMode("feed");
    setNav("tihu");
    setHubView("notes");
  }

  function openArticle(a, opts = {}) {
    setSelected(a);
    setHighlightCommentId(opts.highlightCommentId || "");
    setMode("reader");
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

  function needLogin(msg = "请先登录") {
    setNav("other");
    setOtherTab("settings");
    setMode("auth");
    showToast(msg);
  }

  useEffect(() => {
    if (!authExpiredTick) return;
    needLogin("登录已过期，请重新登录");
    // needLogin / showToast 稳定即可；只跟过期事件走
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authExpiredTick]);

  function goNav(id) {
    setRailOpen(false);
    if (id === "act") {
      setNav("act");
      if (!isLoggedIn) {
        needLogin();
        return;
      }
      // 窄屏：作为默认停在「新笔记」Tab；宽屏仍直接进编辑
      if (narrow) {
        setMode("feed");
        return;
      }
      openCompose(null, { kind: null });
      return;
    }
    if (id === "other") {
      setNav("other");
      setOtherTab("settings");
      setMode(isLoggedIn ? "settings" : "auth");
      return;
    }
    setNav(id);
    setMode("feed");
    if (id === "tihu") {
      setHubView("todos");
      refreshHub().catch(() => {});
    }
    if (id === "calendar") {
      if (!isLoggedIn) {
        needLogin();
        return;
      }
      refreshHub().catch(() => {});
    }
    if (id === "explore") {
      setExploreTab("market");
    }
  }

  function openActAi() {
    if (!isLoggedIn) return needLogin();
    setNav("act");
    setRailOpen(false);
    if (!chatId) {
      const s = createChatSession();
      setChatId(s.id);
    }
    refreshChats();
    setMode("ai");
  }

  /** 醍醐侧栏入口：菜单留在左侧，内容进主栏并刷新数据 */
  async function openHub(view) {
    if (view !== "reads" && !isLoggedIn) return needLogin();
    setNav("tihu");
    setHubView(view);
    setMode("feed");
    setSelected(null);
    setHighlightCommentId("");
    setRailOpen(false);
    try {
      if (view === "reads") {
        refreshReads();
        return;
      }
      if (view === "follow") {
        await Promise.all([refreshFollow(), refreshHub()]);
        return;
      }
      await refreshHub();
    } catch (e) {
      if (e?.authExpired) needLogin("登录已过期，请重新登录");
      else showToast(e.message || "加载失败");
    }
  }

  function backToTihuHome() {
    setHubView("home");
    setMode("feed");
    setSelected(null);
    setHighlightCommentId("");
  }

  const tihuDrilled =
    narrow &&
    nav === "tihu" &&
    (hubView !== "home" ||
      mode === "reader" ||
      mode === "author" ||
      mode === "compose" ||
      mode === "ai");

  const shellClass = [
    "shell",
    narrow ? "is-narrow" : "",
    railOpen ? "rail-open" : "",
    narrow && nav === "tihu" ? "tihu-mobile" : "",
    tihuDrilled ? "tihu-drilled" : "",
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
    if (mode === "compose") return "写笔记";
    if (mode === "ai") return "找 AI";
    if (mode === "auth") return "登录";
    if (mode === "settings" || (nav === "other" && otherTab === "settings"))
      return "账号和设置";
    if (nav === "other" && otherTab === "support") return "客服和联系";
    if (mode === "reader" && selected)
      return displayTitle(selected.title, selected.body);
    if (mode === "author") return profiles[authorId]?.displayName || "陋室";
    if (nav === "explore") return exploreTab === "mine" ? "陋室" : "雅集";
    if (nav === "calendar") return calendarView === "month" ? "月历" : "周历";
    if (nav === "tihu") {
      const map = {
        home: "醍醐",
        todos: "待办事项",
        notes: "近期笔记",
        reads: "近期阅读",
        fav: "我的收藏",
        follow: "留意的人",
        inbox: "评点和回书",
      };
      return map[hubView] || "醍醐";
    }
    return "醍醐";
  })();

  const exploreList = filterList(
    exploreTab === "mine" ? mineArticles : articles,
  );

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
              {nav === "tihu"
                ? "待办 · 笔记 · 阅读 · 留意"
                : nav === "calendar"
                  ? "周历与月历"
                  : nav === "explore"
                    ? "雅集与陋室"
                    : nav === "act"
                      ? "新笔记或找 AI"
                      : "账号与反馈"}
            </p>
          </div>
        </div>

        <div className="middle-body">
          {nav === "calendar" ? (
            <>
              <HubRow
                title="周历"
                summary="按小时查看本周日程与备忘"
                action="打开"
                active={calendarView === "week" && mode === "feed"}
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  setCalendarView("week");
                  setMode("feed");
                  setNav("calendar");
                  refreshHub().catch(() => {});
                }}
              />
              <HubRow
                title="月历"
                summary="按月浏览，点日期看当天"
                action="打开"
                active={calendarView === "month" && mode === "feed"}
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  setCalendarView("month");
                  setMode("feed");
                  setNav("calendar");
                  refreshHub().catch(() => {});
                }}
              />
            </>
          ) : null}

          {nav === "act" ? (
            <>
              <HubRow
                title="新笔记"
                summary="写随笔、备忘、日程或文章"
                action="打开"
                active={mode === "compose"}
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  openCompose(null, { kind: null });
                }}
              />
              <HubRow
                title="找 AI"
                summary="闲聊，也能记笔记、改日程"
                action="打开"
                active={mode === "ai"}
                onClick={openActAi}
              />
            </>
          ) : null}

          {nav === "explore" ? (
            <>
              <HubRow
                title="雅集"
                summary="浏览上架文章"
                action="打开"
                active={exploreTab === "market" && mode === "feed"}
                onClick={() => {
                  setExploreTab("market");
                  setMode("feed");
                  setNav("explore");
                }}
              />
              <HubRow
                title="陋室"
                summary="我上架的文章"
                action="打开"
                active={exploreTab === "mine" && (mode === "feed" || mode === "author")}
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  setExploreTab("mine");
                  setMode("feed");
                  setNav("explore");
                  refreshMine().catch(() => {});
                }}
              />
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
                  setOtherTab("settings");
                  setMode(isLoggedIn ? "settings" : "auth");
                  setNav("other");
                }}
              />
              <HubRow
                title="联系与反馈"
                summary="联系方式与意见反馈"
                action="打开"
                active={otherTab === "support" && mode === "feed"}
                onClick={() => {
                  setOtherTab("support");
                  setMode("feed");
                  setNav("other");
                }}
              />
            </>
          ) : null}

          {nav === "tihu" ? (
            <>
              <HubRow
                title="待办事项"
                summary={
                  todoPreview
                    ? displayTitle(todoPreview.title, todoPreview.body)
                    : "暂无备忘或日程。"
                }
                action="打开"
                active={hubView === "todos" && mode === "feed"}
                onClick={() => openHub("todos")}
              />
              <HubRow
                title="近期笔记"
                summary={
                  latestNote
                    ? snippet(latestNote.title, latestNote.body, 40)
                    : "还没有笔记，去「作为」写一篇吧。"
                }
                action="打开"
                active={hubView === "notes" && mode === "feed"}
                onClick={() => openHub("notes")}
              />
              <HubRow
                title="近期阅读"
                summary={
                  latestRead
                    ? `${displayTitle(latestRead.title, latestRead.body)} · ${formatWhen(latestRead.lastReadAt)}`
                    : "还没有阅读记录。"
                }
                action="打开"
                active={hubView === "reads" && mode === "feed"}
                onClick={() => openHub("reads")}
              />
              <HubRow
                title="我的收藏"
                summary="收藏过的文章"
                action="打开"
                active={hubView === "fav" && (mode === "feed" || mode === "reader")}
                onClick={() => openHub("fav")}
              />
              <HubRow
                title="留意的人"
                summary="留意用户最新上架的文章"
                action="打开"
                active={
                  hubView === "follow" && (mode === "feed" || mode === "reader")
                }
                onClick={() => openHub("follow")}
              />
              <HubRow
                title="评点和回书"
                summary="别人评点、回书或推荐你的文章"
                action="打开"
                active={hubView === "inbox" && mode === "feed"}
                onClick={() => openHub("inbox")}
              />
            </>
          ) : null}

        </div>
      </section>

      <main className="main">
        <div className="main-head">
          <div className="main-head-left">
            {menuBtn}
            {narrow &&
            nav === "tihu" &&
            hubView !== "home" &&
            mode === "feed" ? (
              <button
                type="button"
                className="btn ghost"
                onClick={backToTihuHome}
              >
                返回
              </button>
            ) : null}
            <h2>{mainTitle}</h2>
          </div>
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
          {narrow && nav === "calendar" && mode === "feed" ? (
            <div className="mobile-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={`mobile-tab${calendarView === "week" ? " active" : ""}`}
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  setCalendarView("week");
                  refreshHub().catch(() => {});
                }}
              >
                周历
              </button>
              <button
                type="button"
                role="tab"
                className={`mobile-tab${calendarView === "month" ? " active" : ""}`}
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  setCalendarView("month");
                  refreshHub().catch(() => {});
                }}
              >
                月历
              </button>
            </div>
          ) : null}
          {narrow && nav === "explore" && (mode === "feed" || mode === "author") ? (
            <div className="mobile-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={`mobile-tab${exploreTab === "market" && mode === "feed" ? " active" : ""}`}
                onClick={() => {
                  setExploreTab("market");
                  setMode("feed");
                }}
              >
                雅集
              </button>
              <button
                type="button"
                role="tab"
                className={`mobile-tab${exploreTab === "mine" ? " active" : ""}`}
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  setExploreTab("mine");
                  setMode("feed");
                  refreshMine().catch(() => {});
                }}
              >
                陋室
              </button>
            </div>
          ) : null}
          {narrow && nav === "act" ? (
            <div className="mobile-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={`mobile-tab${mode === "compose" || mode === "feed" ? " active" : ""}`}
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  openCompose(null, { kind: null });
                }}
              >
                新笔记
              </button>
              <button
                type="button"
                role="tab"
                className={`mobile-tab${mode === "ai" ? " active" : ""}`}
                onClick={openActAi}
              >
                找 AI
              </button>
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
        <div className={`main-body${mode === "ai" || mode === "compose" ? " main-body-flush" : ""}`}>
          {loading || authLoading ? (
            <div className="loading">加载中…</div>
          ) : mode === "compose" ? (
            <NoteEditor
              key={composeNote?.id || "new"}
              note={composeNote}
              toast={showToast}
              initialScheduleAt={composeScheduleAt}
              initialRemindAt={composeRemindAt}
              initialKind={composeKind}
              onCancel={() => {
                clearCompose();
                setMode("feed");
                if (nav === "act") setNav("act");
              }}
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
          ) : mode === "ai" ? (
            <div className="ai-split">
              <div className="ai-split-main">
                <AiChat
                  sessionId={chatId}
                  onSessionChange={(id) => {
                    setChatId(id);
                    refreshChats();
                  }}
                  onNeedLogin={needLogin}
                  onNotesChanged={() => {
                    refreshHub().catch(() => {});
                    refreshExplore().catch(() => {});
                    refreshMine().catch(() => {});
                  }}
                  toast={showToast}
                />
              </div>
              <aside className="ai-split-aside">
                <div className="ai-aside-head">
                  <strong>对话</strong>
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ fontSize: 12, padding: "4px 8px" }}
                    onClick={() => {
                      const s = createChatSession();
                      setChatId(s.id);
                      refreshChats();
                    }}
                  >
                    新对话
                  </button>
                </div>
                <div className="ai-aside-list">
                  {chatList.length === 0 ? (
                    <div className="empty" style={{ padding: 16 }}>
                      暂无历史对话
                    </div>
                  ) : (
                    chatList.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`ai-aside-item ${chatId === s.id ? "active" : ""}`}
                        onClick={() => setChatId(s.id)}
                      >
                        <div className="title">{s.title || "对话"}</div>
                        <div className="meta">
                          <span>{formatWhen(s.updatedAt)}</span>
                          <span
                            className="ai-aside-del"
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteChatSession(s.id);
                              refreshChats();
                              if (chatId === s.id) {
                                const next = listChatSessions()[0];
                                setChatId(next?.id || "");
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.click();
                            }}
                          >
                            删
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </aside>
            </div>
          ) : mode === "auth" ? (
            <AuthPanel
              onDone={() => {
                setOtherTab("settings");
                setMode("settings");
                setNav("other");
                showToast("登录成功");
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
          ) : nav === "calendar" ? (
            <CalendarPanel
              notes={notes}
              view={calendarView}
              onViewChange={setCalendarView}
              onOpenNote={(n) => openCompose(n)}
              onCreateSchedule={(at) => {
                const iso = at instanceof Date ? at.toISOString() : at;
                openCompose(null, {
                  scheduleAt: iso,
                  kind: "schedule",
                });
              }}
              onCreateMemo={(at) => {
                const iso = at instanceof Date ? at.toISOString() : at;
                openCompose(null, {
                  remindAt: iso,
                  kind: "memo",
                });
              }}
            />
          ) : nav === "tihu" && hubView === "todos" ? (
            <div className="hub-main-list">
              {todos.length === 0 ? (
                <div className="empty">暂无备忘或日程</div>
              ) : (
                todos.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="list-item"
                    onClick={() => openCompose(n)}
                  >
                    <UserAvatar profile={{ displayName: n.kind }} />
                    <div>
                      <div className="title">
                        {displayTitle(n.title, n.body)}
                      </div>
                      <div className="meta">
                        {n.kind === "schedule" ? "日程" : "备忘"}
                      </div>
                    </div>
                    <div className="time">
                      {formatWhen(n.scheduleAt || n.remindAt || n.updatedAt)}
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : nav === "tihu" && hubView === "notes" ? (
            <div className="hub-main-list">
              {notes.length === 0 ? (
                <div className="empty">还没有笔记，去「作为」写一篇吧</div>
              ) : (
                notes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="list-item"
                    onClick={() => openCompose(n)}
                  >
                    <UserAvatar profile={{ displayName: n.kind || "笔" }} />
                    <div>
                      <div className="title">
                        {displayTitle(n.title, n.body)}
                      </div>
                      <div className="meta">{snippet(n.title, n.body, 40)}</div>
                    </div>
                    <div className="time">{formatWhen(n.updatedAt)}</div>
                  </button>
                ))
              )}
            </div>
          ) : nav === "tihu" && hubView === "reads" ? (
            <div className="hub-main-list">
              {recentReads.length === 0 ? (
                <div className="empty">
                  还没有阅读记录。去「求索 → 雅集」点开文章后会出现在这里。
                </div>
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
          ) : nav === "tihu" && hubView === "fav" ? (
            <ArticleFeed
              articles={filterList(favorites)}
              profiles={profiles}
              selectedId={selected?.id}
              onSelect={openArticle}
              emptyText="还没有收藏"
            />
          ) : nav === "tihu" && hubView === "follow" ? (
            <ArticleFeed
              articles={filterList(followArticles)}
              profiles={profiles}
              selectedId={selected?.id}
              onSelect={openArticle}
              emptyText="留意作者后，这里会出现动态"
            />
          ) : nav === "tihu" && hubView === "inbox" ? (
            <div className="hub-main-list">
              {notices.length === 0 ? (
                <div className="empty">暂无评点或回书</div>
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
                        } else showToast("文章可能已下架");
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
                            ? "回书了你"
                            : n.kind === "comment"
                              ? "评点了你的文章"
                              : n.body || n.kind}
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : nav === "tihu" && hubView === "home" ? (
            <div className="empty">
              {narrow ? "请从上方入口进入" : "从左侧选择入口"}
            </div>
          ) : nav === "act" && mode === "feed" ? (
            <div className="empty">选择「新笔记」开始写，或「找 AI」对话</div>
          ) : nav === "explore" ? (
            <ArticleFeed
              articles={exploreList}
              profiles={profiles}
              selectedId={selected?.id}
              onSelect={openArticle}
              emptyText="雅集暂无文章"
            />
          ) : (
            <div className="empty">从左侧选择入口</div>
          )}
        </div>
      </main>

      {toast ? <div className="toast">{toast}</div> : null}
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

function ArticleListItem({ a, profile, active, onClick }) {
  return (
    <button
      type="button"
      className={`list-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <UserAvatar profile={profile} />
      <div>
        <div className="title">{displayTitle(a.title, a.body)}</div>
        <div className="meta">{excerpt(a.body, 48)}</div>
      </div>
      <div className="time">{formatWhen(a.listedAt)}</div>
    </button>
  );
}
