"use client";

import { useEffect, useRef, useState } from "react";
import { appDownloadHint } from "../lib/site";
import { useAuth } from "./AuthProvider";
import { IconMenu } from "./icons";
import UserAvatar from "./UserAvatar";

/**
 * 全站顶栏：小屏菜单按钮 + logo；右侧下载 / 登录或头像下拉。
 */
export default function AppHeader({
  narrow = false,
  railOpen = false,
  onToggleRail,
  onOpenAuth,
  onOpenSettings,
}) {
  const { isLoggedIn, profile, user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const downloadHint = appDownloadHint();
  const displayName =
    profile?.displayName || profile?.nickname || user?.email || "用户";

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="app-top-header">
      <div className="app-top-header-left">
        {narrow ? (
          <button
            type="button"
            className="mobile-menu-btn app-top-menu-btn"
            aria-label={railOpen ? "收起菜单" : "打开菜单"}
            onClick={() => onToggleRail?.()}
          >
            <IconMenu />
          </button>
        ) : null}
        <a href="/" className="app-top-brand" title="醍醐">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/app_icon.png" alt="醍醐" className="app-top-logo" />
          <span className="app-top-brand-name">醍醐</span>
        </a>
      </div>
      <div className="app-top-header-right">
        <a
          className="btn ghost app-top-download"
          href="/download"
          title={downloadHint || "下载醍醐 App"}
        >
          下载 App
        </a>
        {isLoggedIn ? (
          <div className="app-top-user" ref={menuRef}>
            <button
              type="button"
              className="app-top-user-btn"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <UserAvatar profile={profile} size="sm" />
              <span className="app-top-user-name">{displayName}</span>
              <span className="app-top-caret" aria-hidden>
                ▾
              </span>
            </button>
            {menuOpen ? (
              <div className="app-top-dropdown" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenSettings?.();
                  }}
                >
                  账号设置
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    setMenuOpen(false);
                    try {
                      await signOut();
                    } catch (_) {}
                  }}
                >
                  退出登录
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="btn app-top-auth"
            onClick={() => onOpenAuth?.()}
          >
            登录/注册
          </button>
        )}
      </div>
    </header>
  );
}
