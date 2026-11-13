"use client";

import { useEffect, useRef, useState } from "react";
import { uploadMyAvatar, upsertMyProfile } from "../lib/api";
import { appDownloadHint, appDownloadUrl } from "../lib/site";
import AvatarCropModal from "./AvatarCropModal";
import { useAuth } from "./AuthProvider";
import AuthPanel from "./AuthPanel";
import UserAvatar from "./UserAvatar";

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
  const [cropFile, setCropFile] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    setNick(profile?.nickname || "");
  }, [profile?.nickname]);

  if (!isLoggedIn) {
    return <AuthPanel />;
  }

  const download = appDownloadUrl();

  async function uploadCropped(file) {
    setCropFile(null);
    setBusy(true);
    try {
      const data = await uploadMyAvatar(file);
      if (data?.profile) setProfile(data.profile);
      await refreshProfile();
      toast?.("头像已更新");
    } catch (err) {
      toast?.(err.message || "上传失败");
    } finally {
      setBusy(false);
    }
  }

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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <UserAvatar profile={profile} size="lg" />
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setCropFile(file);
            }}
          />
          <button
            className="btn ghost"
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            上传头像
          </button>
        </div>
      </div>

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
          <span className="sub">EdgeOne → Supabase</span>
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

      {cropFile ? (
        <AvatarCropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onConfirm={uploadCropped}
        />
      ) : null}
    </div>
  );
}
