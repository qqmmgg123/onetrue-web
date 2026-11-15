"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { IconEye } from "./icons";

/**
 * 登录 / 注册（邮箱+密码；注册需邮箱验证码，国内送达靠 Supabase 自定义 SMTP）
 */
export default function AuthPanel({ onDone }) {
  const { signIn, signUp, verifyOtp, resendOtp, configured } = useAuth();
  const [mode, setMode] = useState("login"); // login | register | otp
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

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

  async function onLogin(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn({ email, password });
      onDone?.();
    } catch (err) {
      setError(err.message || "登录失败");
    } finally {
      setBusy(false);
    }
  }

  async function onRegister(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!nickname.trim()) {
      setError("请填写昵称");
      return;
    }
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    setBusy(true);
    try {
      const data = await signUp({ email, password, nickname });
      if (data?.needsOtp) {
        setMode("otp");
        setInfo(data.message || "验证码已发送到邮箱");
        setCooldown(60);
        return;
      }
      onDone?.();
    } catch (err) {
      setError(err.message || "注册失败");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await verifyOtp({
        email,
        token: otp,
        type: "signup",
        nickname,
      });
      onDone?.();
    } catch (err) {
      setError(err.message || "验证失败");
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (cooldown > 0 || busy) return;
    setError("");
    setBusy(true);
    try {
      await resendOtp({ email, type: "signup" });
      setInfo("验证码已重新发送");
      setCooldown(60);
    } catch (err) {
      setError(err.message || "发送失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      {mode !== "otp" ? (
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={`auth-tab${mode === "login" ? " active" : ""}`}
            onClick={() => {
              setMode("login");
              setError("");
              setInfo("");
            }}
          >
            登录
          </button>
          <button
            type="button"
            role="tab"
            className={`auth-tab${mode === "register" ? " active" : ""}`}
            onClick={() => {
              setMode("register");
              setError("");
              setInfo("");
            }}
          >
            注册
          </button>
        </div>
      ) : (
        <h2>验证邮箱</h2>
      )}

      {mode === "otp" ? (
        <>
          <p className="hint">
            验证码已发至 <strong>{email}</strong>
            。若国内邮箱收不到，请在 Supabase 配置阿里云/腾讯云 SMTP（见文档）。
          </p>
          <form onSubmit={onVerify}>
            <div className="field">
              <label>验证码</label>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6 位验证码"
                required
              />
            </div>
            {info ? <p className="hint">{info}</p> : null}
            {error ? <div className="error">{error}</div> : null}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "验证中…" : "完成注册"}
            </button>
            <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
              <button
                type="button"
                className="btn ghost"
                disabled={busy || cooldown > 0}
                onClick={onResend}
              >
                {cooldown > 0 ? `${cooldown}s 后可重发` : "重发验证码"}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => {
                  setMode("register");
                  setOtp("");
                  setError("");
                }}
              >
                返回
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <p className="hint">
            {mode === "login"
              ? "使用已注册的邮箱与密码登录。"
              : "注册后需验证邮箱；密码至少 6 位。"}
          </p>
          <form onSubmit={mode === "login" ? onLogin : onRegister}>
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
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === "register" ? 6 : undefined}
                />
              </div>
            </div>
            {mode === "register" ? (
              <div className="field">
                <label>昵称</label>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="显示名称"
                  required
                />
              </div>
            ) : null}
            {error ? <div className="error">{error}</div> : null}
            <button className="btn" type="submit" disabled={busy}>
              {busy
                ? mode === "login"
                  ? "登录中…"
                  : "提交中…"
                : mode === "login"
                  ? "登录"
                  : "注册"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
