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
import AiChat from "./AiChat";
import ArticleFeed from "./ArticleFeed";
import ArticleReader from "./ArticleReader";
import AuthPanel from "./AuthPanel";
import { useAuth } from "./AuthProvider";
import CalendarPanel from "./CalendarPanel";
import {
  IconCalendar,
  IconEdit,
  IconExplore,
  IconMore,
  IconSearch,
  IconTihu,
} from "./icons";
import NoteEditor from "./NoteEditor";
import SettingsPanel from "./SettingsPanel";
import UserAvatar from "./UserAvatar";

const NAV = [
  { id: "tihu", label: "醍醐", Icon: IconTihu },
  { id: "calendar", label: "光阴", Icon: IconCalendar },
  { id: "explore", label: "求索", Icon: IconExplore },
  { id: "act", label: "作为", Icon: IconEdit },
  { id: "other", label: "其他", Icon: IconMore },
];

export default function AppShell({ initialArticleId = "" }) {
  const { isLoggedIn, loading: authLoading, user } = useAuth();
  const [nav, setNav] = useState("tihu");
  const [exploreTab, setExploreTab] = useState("market");
  const [hubView, setHubView] = useState("home"); // home | todos | notes | reads | fav | follow | inbox
  const [query, setQuery] = useState("");
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
  const [showListMobile, setShowListMobile] = useState(false);
  const [chatId, setChatId] = useState("");
  const [chatList, setChatList] = useState([]);
  const [composeScheduleAt, setComposeScheduleAt] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2600);
  }, []);

  const refreshChats = useCallback(() => {
    setChatList(listChatSessions());
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
  }, [
    authLoading,
    isLoggedIn,
    refreshHub,
    refreshFollow,
    refreshMine,
    refreshChats,
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
    setNav("other");
    setMode("auth");
    showToast("请先登录");
  }

  function goNav(id) {
    setShowListMobile(true);
    if (id === "act") {
      setNav("act");
      setMode("act-sheet");
      return;
    }
    if (id === "other") {
      setNav("other");
      setMode(isLoggedIn ? "settings" : "auth");
      return;
    }
    setNav(id);
    setMode("feed");
    if (id === "tihu") setHubView("home");
    if (id === "calendar" && !isLoggedIn) needLogin();
  }

  const mainTitle = (() => {
    if (mode === "compose") return "写笔记";
    if (mode === "ai") return "找 AI";
    if (mode === "act-sheet") return "作为";
    if (mode === "auth") return "登录";
    if (mode === "settings") return "其他";
    if (mode === "reader" && selected)
      return displayTitle(selected.title, selected.body);
    if (mode === "author") return profiles[authorId]?.displayName || "陋室";
    if (nav === "explore") return exploreTab === "mine" ? "陋室" : "雅集";
    if (nav === "calendar") return "光阴";
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
    <div className={`shell ${showListMobile ? "show-list" : ""}`}>
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
        <button
          type="button"
          className="rail-btn"
          title="列表"
          onClick={() => setShowListMobile((v) => !v)}
        >
          <IconSearch />
          <span className="rail-label">列表</span>
        </button>
      </aside>

      <section className="middle">
        <div className="middle-head">
          <h1>{NAV.find((n) => n.id === nav)?.label || "醍醐"}</h1>
          <p className="middle-sub">
            {nav === "tihu"
              ? "待办 · 笔记 · 阅读 · 留意"
              : nav === "calendar"
                ? "月历与日程"
                : nav === "explore"
                  ? "雅集文章"
                  : nav === "act"
                    ? "写笔记或找 AI"
                    : "账号与设置"}
          </p>
          {nav === "explore" ? (
            <div className="middle-search">
              <IconSearch />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索标题或正文"
              />
            </div>
          ) : null}
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
              雅集
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

        <div className="middle-body">
          {nav === "tihu" && hubView === "home" ? (
            <>
              <HubRow
                title="待办事项"
                summary={
                  todoPreview
                    ? displayTitle(todoPreview.title, todoPreview.body)
                    : "暂无备忘或日程。"
                }
                action="查看全部"
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  setHubView("todos");
                }}
              />
              <HubRow
                title="近期笔记"
                summary={
                  latestNote
                    ? snippet(latestNote.title, latestNote.body, 40)
                    : "还没有笔记，去「作为」写一篇吧。"
                }
                action="查看全部"
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  setHubView("notes");
                }}
              />
              <HubRow
                title="近期阅读"
                summary="阅读记录请在 App 同步后查看，或去雅集浏览。"
                action="进入雅集"
                onClick={() => {
                  setNav("explore");
                  setMode("feed");
                }}
              />
              <HubRow
                title="我的收藏"
                summary="收藏过的文章"
                action="进入"
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  setHubView("fav");
                  setMode("feed");
                }}
              />
              <HubRow
                title="留意的人"
                summary="查看留意用户最新上架的文章"
                action="进入"
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  setHubView("follow");
                  refreshFollow().catch(() => {});
                  setMode("feed");
                }}
              />
              <HubRow
                title="评点和回书"
                summary="别人评点、回书或推荐你的文章"
                action="进入"
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  setHubView("inbox");
                }}
              />
            </>
          ) : null}

          {nav === "tihu" && hubView === "todos"
            ? (todos.length ? todos : []).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="list-item"
                  onClick={() => showToast("备忘/日程详情请在 App「光阴」编辑")}
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
            : null}

          {nav === "tihu" && hubView === "notes"
            ? notes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="list-item"
                  onClick={() => {
                    if (n.kind === "article" && n.listingStatus === "listed") {
                      openArticle({
                        id: n.id,
                        title: n.title,
                        body: n.body,
                        format: n.format,
                        city: n.city || "",
                        listedAt: n.listedAt || n.updatedAt,
                        ownerId: n.ownerId || user?.id || "",
                        viewCount: 0,
                        recommendCount: 0,
                        commentCount: 0,
                      });
                    } else {
                      showToast("随笔请在「作为」继续编辑（Web 以新写为主）");
                    }
                  }}
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
            : null}

          {nav === "tihu" && hubView === "fav"
            ? filterList(favorites).map((a) => (
                <ArticleListItem
                  key={a.id}
                  a={a}
                  profile={profiles[a.ownerId]}
                  active={selected?.id === a.id && mode === "reader"}
                  onClick={() => openArticle(a)}
                />
              ))
            : null}

          {nav === "tihu" && hubView === "follow"
            ? filterList(followArticles).map((a) => (
                <ArticleListItem
                  key={a.id}
                  a={a}
                  profile={profiles[a.ownerId]}
                  active={selected?.id === a.id && mode === "reader"}
                  onClick={() => openArticle(a)}
                />
              ))
            : null}

          {nav === "tihu" && hubView === "inbox"
            ? (notices.length === 0 ? (
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
                        if (a) openArticle(a);
                        else showToast("文章可能已下架");
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
              ))
            : null}

          {nav === "explore"
            ? exploreList.map((a) => (
                <ArticleListItem
                  key={a.id}
                  a={a}
                  profile={profiles[a.ownerId]}
                  active={selected?.id === a.id && mode === "reader"}
                  onClick={() => openArticle(a)}
                />
              ))
            : null}

          {nav === "calendar" ? (
            <div className="empty" style={{ paddingTop: 32 }}>
              右侧查看月历与当日事项
            </div>
          ) : null}

          {nav === "act" && mode === "ai" ? (
            <>
              <div style={{ padding: "10px 16px", display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    const s = createChatSession();
                    setChatId(s.id);
                    refreshChats();
                    setMode("ai");
                  }}
                >
                  新对话
                </button>
              </div>
              {chatList.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`list-item ${chatId === s.id ? "active" : ""}`}
                  style={{ gridTemplateColumns: "1fr auto" }}
                  onClick={() => {
                    setChatId(s.id);
                    setMode("ai");
                  }}
                >
                  <div>
                    <div className="title">{s.title || "对话"}</div>
                    <div className="meta">{formatWhen(s.updatedAt)}</div>
                  </div>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChatSession(s.id);
                      refreshChats();
                      if (chatId === s.id) {
                        const next = listChatSessions()[0];
                        setChatId(next?.id || "");
                      }
                    }}
                  >
                    删
                  </button>
                </button>
              ))}
            </>
          ) : null}

          {nav === "other" ? (
            <div className="empty" style={{ paddingTop: 32 }}>
              {isLoggedIn ? "右侧打开设置" : "登录后可同步与上架"}
            </div>
          ) : null}
        </div>
      </section>

      <main className="main">
        <div className="main-head">
          <h2>{mainTitle}</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {nav === "tihu" && hubView !== "home" ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => setHubView("home")}
              >
                返回醍醐
              </button>
            ) : null}
            {mode === "reader" ||
            mode === "author" ||
            mode === "compose" ||
            mode === "ai" ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  if (mode === "ai") {
                    setMode("act-sheet");
                    return;
                  }
                  setMode("feed");
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
        </div>
        <div className="main-body">
          {loading || authLoading ? (
            <div className="loading">加载中…</div>
          ) : mode === "act-sheet" ? (
            <div className="action-sheet">
              <h2 style={{ marginTop: 0 }}>作为</h2>
              <button
                type="button"
                className="sheet-item"
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  setComposeScheduleAt(null);
                  setMode("compose");
                }}
              >
                <IconEdit /> 新笔记
              </button>
              <button
                type="button"
                className="sheet-item"
                onClick={() => {
                  if (!isLoggedIn) return needLogin();
                  if (!chatId) {
                    const s = createChatSession();
                    setChatId(s.id);
                  }
                  refreshChats();
                  setMode("ai");
                  setNav("act");
                }}
              >
                <IconExplore /> 找 AI
              </button>
            </div>
          ) : mode === "compose" ? (
            <NoteEditor
              toast={showToast}
              initialScheduleAt={composeScheduleAt}
              onCancel={() => setMode(nav === "act" ? "act-sheet" : "feed")}
              onCreated={async (note) => {
                await refreshHub().catch(() => {});
                await refreshExplore().catch(() => {});
                await refreshMine().catch(() => {});
                setComposeScheduleAt(null);
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
                } else {
                  setMode("feed");
                  setNav("tihu");
                  setHubView("notes");
                }
              }}
            />
          ) : mode === "ai" ? (
            <AiChat
              sessionId={chatId}
              onSessionChange={(id) => {
                setChatId(id);
                refreshChats();
              }}
              onNeedLogin={needLogin}
              toast={showToast}
            />
          ) : mode === "auth" ? (
            <AuthPanel
              onDone={() => {
                setMode("settings");
                setNav("other");
                showToast("登录成功");
              }}
            />
          ) : mode === "settings" || (nav === "other" && isLoggedIn) ? (
            <SettingsPanel toast={showToast} />
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
          ) : nav === "calendar" ? (
            <CalendarPanel
              notes={notes}
              onOpenNote={() =>
                showToast("日程详情编辑请用 App；此处可新建")
              }
              onCreateSchedule={(day) => {
                if (!isLoggedIn) return needLogin();
                setComposeScheduleAt(day.toISOString());
                setMode("compose");
              }}
            />
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

function HubRow({ title, summary, action, onClick }) {
  return (
    <button type="button" className="hub-row" onClick={onClick}>
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
