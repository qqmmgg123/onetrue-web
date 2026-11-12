"use client";

import { useState } from "react";
import { upsertMyProfile } from "../lib/api";
import { appDownloadHint, appDownloadUrl } from "../lib/site";
import { useAuth } from "./AuthProvider";
import AuthPanel from "./AuthPanel";

export default function SettingsPanel({ toast }) {
  const {
    isLoggedIn,
    user,
    profile,
    signOut,
    refreshProfile,
    setProfile,
    gatewayOk,
  } = useAuth();
  const [nick, setNick] = useState(profile?.nickname || "");
  const [busy, setBusy] = useState(false);

  if (!isLoggedIn) {
    return <AuthPanel />;
  }

  const download = appDownloadUrl();

  return (
    <div className="panel">
      <h2>我的</h2>
      <p className="hint">
        {profile?.displayName || "用户"}
        {user?.email ? ` · ${user.email}` : ""}
        {gatewayOk === true
          ? " · 网关正常"
          : gatewayOk === false
            ? " · 网关异常"
            : ""}
      </p>

      <div className="field">
        <label>昵称</label>
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          placeholder="显示名称"
        />
      </div>
      <button
        className="btn"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const p = await upsertMyProfile({ nickname: nick });
            setProfile(p);
            await refreshProfile();
            toast?.("已保存");
          } catch (e) {
            toast?.(e.message || "保存失败");
          } finally {
            setBusy(false);
          }
        }}
      >
        保存昵称
      </button>

      <div className="settings-list" style={{ marginTop: 28 }}>
        {download ? (
          <a href={download} target="_blank" rel="noreferrer">
            <span>{appDownloadHint()}</span>
            <span className="sub">下载</span>
          </a>
        ) : null}
        <div className="row">
          <span>API 网关</span>
          <span className="sub">/api/auth · /api/articles</span>
        </div>
        <div className="row">
          <span>数据同步</span>
          <span className="sub">登录后自动归属当前账号</span>
        </div>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            toast?.("已退出");
          }}
        >
          <span>退出登录</span>
          <span className="sub">回到游客</span>
        </button>
      </div>
    </div>
  );
}
