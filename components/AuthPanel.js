"use client";

import { useEffect, useState } from "react";
import { userFacingError } from "../lib/user-facing-error";
import { useAuth } from "./AuthProvider";
import { IconEye } from "./icons";

function PasswordInput({
  value,
  onChange,
  autoComplete,
  show,
  onToggle,
  minLength,
}) {
  return (
    <div className="password-field">
      <button
        type="button"
        className="password-toggle"
        aria-label={show ? "隐藏密码" : "显示密码"}
        title={show ? "隐藏密码" : "显示密码"}
        onClick={onToggle}
      >
        <IconEye off={show} />
      </button>
      <input
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        required
        minLength={minLength}
      />
    </div>
  );
}

/**
 * 登录 / 注册 / 忘记密码（邮箱 OTP 风格）
 */
export default function AuthPanel({ onDone }) {
  const {
    signIn,
    signUp,
    verifyOtp,
    resendOtp,
    forgotPassword,
    resetPassword,
    configured,
  } = useAuth();
  // login | register | otp | forgot | reset
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
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

  async function goVerifyExisting() {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("请先填写邮箱");
      return;
    }
    setBusy(true);
    try {
      await resendOtp({ email, type: "signup" });
      setMode("otp");
      setInfo("验证码已发送到邮箱，请查收后完成验证");
      setCooldown(60);
    } catch (err) {
      // 即便发送失败也进入验证页，方便输入旧码或稍后重发
      setMode("otp");
      setError(userFacingError(err, "发送失败"));
      setInfo("若此前已发过验证码，可直接输入；也可稍后重发");
    } finally {
      setBusy(false);
    }
  }

  async function onLogin(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn({ email, password });
      onDone?.();
    } catch (err) {
      if (err?.needsOtp || err?.code === "email_not_confirmed") {
        setBusy(false);
        await goVerifyExisting();
        return;
      }
      const msg = userFacingError(err, "登录失败");
      if (msg.includes("尚未验证")) {
        setBusy(false);
        await goVerifyExisting();
        return;
      }
      setError(msg);
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
      setError(userFacingError(err, "注册失败"));
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
      setError(userFacingError(err, "验证失败"));
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
      setError(userFacingError(err, "发送失败"));
    } finally {
      setBusy(false);
    }
  }

  async function onForgot(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const data = await forgotPassword({ email });
      setMode("reset");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setInfo(data?.message || "若该邮箱已注册，验证码将发送到邮箱");
      setCooldown(60);
    } catch (err) {
      setError(userFacingError(err, "发送失败"));
    } finally {
      setBusy(false);
    }
  }

  async function onResendReset() {
    if (cooldown > 0 || busy) return;
    setError("");
    setBusy(true);
    try {
      await forgotPassword({ email });
      setInfo("验证码已重新发送");
      setCooldown(60);
    } catch (err) {
      setError(userFacingError(err, "发送失败"));
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (newPassword.length < 6) {
      setError("新密码至少 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    setBusy(true);
    try {
      await resetPassword({
        email,
        token: otp,
        password: newPassword,
      });
      onDone?.();
    } catch (err) {
      setError(userFacingError(err, "重置失败"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      {mode === "login" || mode === "register" ? (
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
      ) : mode === "otp" ? (
        <h2>验证邮箱</h2>
      ) : mode === "forgot" ? (
        <h2>忘记密码</h2>
      ) : (
        <h2>重置密码</h2>
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
                placeholder="邮件中的验证码"
                required
              />
            </div>
            {info ? <p className="hint">{info}</p> : null}
            {error ? <div className="error">{error}</div> : null}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "验证中…" : "完成验证"}
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
      ) : mode === "forgot" ? (
        <>
          <p className="hint">输入注册邮箱，我们将发送验证码用于重置密码。</p>
          <form onSubmit={onForgot}>
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
            {info ? <p className="hint">{info}</p> : null}
            {error ? <div className="error">{error}</div> : null}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "发送中…" : "发送验证码"}
            </button>
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => {
                  setMode("login");
                  setError("");
                  setInfo("");
                }}
              >
                返回登录
              </button>
            </div>
          </form>
        </>
      ) : mode === "reset" ? (
        <>
          <p className="hint">
            验证码已发至 <strong>{email}</strong>
            。请输入验证码并设置新密码。
          </p>
          <form onSubmit={onReset}>
            <div className="field">
              <label>验证码</label>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="邮件中的验证码"
                required
              />
            </div>
            <div className="field">
              <label>新密码</label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                show={showNewPassword}
                onToggle={() => setShowNewPassword((v) => !v)}
                minLength={6}
              />
            </div>
            <div className="field">
              <label>确认新密码</label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                show={showNewPassword}
                onToggle={() => setShowNewPassword((v) => !v)}
                minLength={6}
              />
            </div>
            {info ? <p className="hint">{info}</p> : null}
            {error ? <div className="error">{error}</div> : null}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "重置中…" : "确认重置"}
            </button>
            <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
              <button
                type="button"
                className="btn ghost"
                disabled={busy || cooldown > 0}
                onClick={onResendReset}
              >
                {cooldown > 0 ? `${cooldown}s 后可重发` : "重发验证码"}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => {
                  setMode("forgot");
                  setOtp("");
                  setNewPassword("");
                  setConfirmPassword("");
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
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                show={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                minLength={mode === "register" ? 6 : undefined}
              />
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
            {mode === "login" ? (
              <div style={{ marginBottom: 12, textAlign: "right" }}>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ padding: "4px 8px", fontSize: 13 }}
                  onClick={() => {
                    setMode("forgot");
                    setError("");
                    setInfo("");
                    setOtp("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  忘记密码？
                </button>
              </div>
            ) : null}
            <button className="btn" type="submit" disabled={busy}>
              {busy
                ? mode === "login"
                  ? "登录中…"
                  : "提交中…"
                : mode === "login"
                  ? "登录"
                  : "注册"}
            </button>
            {mode === "register" ? (
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy}
                  onClick={goVerifyExisting}
                >
                  已注册未验证？去验证邮箱
                </button>
              </div>
            ) : null}
          </form>
        </>
      )}
    </div>
  );
}
