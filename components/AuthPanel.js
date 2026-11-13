"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { IconEye } from "./icons";

export default function AuthPanel({ onDone }) {
  const { signIn, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!configured) {
    return (
      <div className="panel">
        <h2>未配置云端</h2>
        <p className="hint">
          请在 share-web/.env.local 填写 SUPABASE_URL 与 SUPABASE_ANON_KEY（服务端网关用，与
          App 同一项目）。
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>登录</h2>
      <p className="hint">使用邮箱与密码登录。</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          try {
            await signIn({ email, password, nickname });
            onDone?.();
          } catch (err) {
            setError(err.message || "登录失败");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="field">
          <label>邮箱</label>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>密码</label>
          <div className="password-field">
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
              title={showPassword ? "隐藏密码" : "显示密码"}
              onClick={() => setShowPassword((v) => !v)}
            >
              <IconEye off={showPassword} />
            </button>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="field">
          <label>昵称（可选，用于补全档案）</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="显示名称"
          />
        </div>
        {error ? <div className="error">{error}</div> : null}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "登录中…" : "登录"}
        </button>
      </form>
    </div>
  );
}
