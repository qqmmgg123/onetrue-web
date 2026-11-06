"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function detectPlatform() {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPadOS 13+ 桌面 UA
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/**
 * 市场常见引导：
 * 1) 微信内：不直接下 APK，蒙层箭头提示「右上角 ··· → 在浏览器打开」
 * 2) 系统浏览器：先尝试唤起已装 App；未装（约 2s 仍停在页）再下载 APK
 * 3) iOS：提示暂不支持；Android 按钮标明 Android 版本
 */
export default function DownloadAppButton({
  downloadUrl,
  roomId = "",
  style,
}) {
  const [platform, setPlatform] = useState("unknown");
  const [guide, setGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);
  const packageName =
    process.env.NEXT_PUBLIC_APP_PACKAGE || "com.local.rent.rent_agent";
  const scheme = process.env.NEXT_PUBLIC_APP_SCHEME || "yunchu";

  useEffect(() => {
    setPlatform(detectPlatform());
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const goDownload = useCallback(() => {
    if (!downloadUrl) return;
    window.location.href = downloadUrl;
  }, [downloadUrl]);

  const tryOpenApp = useCallback(() => {
    if (!downloadUrl) return;
    setBusy(true);

    const onVis = () => {
      if (document.hidden) {
        clearTimer();
        setBusy(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", clearTimer);

    clearTimer();
    timerRef.current = setTimeout(() => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", clearTimer);
      setBusy(false);
      goDownload();
    }, 2200);

    const path = roomId ? `open?room=${encodeURIComponent(roomId)}` : "open";
    const deepLink = `${scheme}://${path}`;
    const fallback = encodeURIComponent(downloadUrl);
    const intentUrl =
      `intent://${path}` +
      `#Intent;scheme=${scheme};package=${packageName};` +
      `S.browser_fallback_url=${fallback};end`;

    try {
      window.location.href = intentUrl;
    } catch (_) {
      window.location.href = deepLink;
    }
  }, [downloadUrl, roomId, scheme, packageName, goDownload]);

  const onClick = (e) => {
    e.preventDefault();
    if (!downloadUrl) return;

    const ua = navigator.userAgent || "";
    if (/MicroMessenger/i.test(ua)) {
      setGuide(true);
      return;
    }
    if (platform === "other") {
      // 桌面等：直接下 Android 包
      goDownload();
      return;
    }
    tryOpenApp();
  };

  if (!downloadUrl) return null;

  // —— iOS：不提供下载 ——
  if (platform === "ios") {
    return (
      <div
        style={{
          marginTop: 4,
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,.25)",
          background: "rgba(255,255,255,.06)",
          color: "rgba(255,255,255,.78)",
          fontSize: 14,
          lineHeight: 1.5,
          ...style,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AppleIcon />
          <span>暂时不支持 iOS 版下载</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,.45)" }}>
          请使用 Android 手机打开本页安装
        </div>
      </div>
    );
  }

  if (platform === "unknown") {
    // SSR / 首帧：占位，避免闪错文案
    return (
      <div
        style={{
          marginTop: 4,
          height: 42,
          opacity: 0.4,
          ...style,
        }}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginTop: 4,
          padding: "10px 16px",
          border: "1px solid rgba(255,255,255,.55)",
          borderRadius: 8,
          color: "#fff",
          background: "transparent",
          fontSize: 15,
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.7 : 1,
          ...style,
        }}
      >
        <AndroidIcon />
        <span>
          {busy ? "正在打开 App…" : "打开 / 下载"}
        </span>
        <span
          style={{
            fontSize: 11,
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(61, 220, 132, .22)",
            color: "#7dffa8",
            fontWeight: 600,
            letterSpacing: 0.3,
          }}
        >
          Android
        </span>
      </button>

      {guide ? <WeChatOpenGuide onClose={() => setGuide(false)} /> : null}
    </>
  );
}

function AndroidIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.6 9.48l1.84-3.18a.5.5 0 10-.87-.5l-1.86 3.22A8.9 8.9 0 0012 8c-1.64 0-3.16.44-4.71 1.02L5.43 5.8a.5.5 0 10-.87.5L6.4 9.48C3.97 10.84 2.5 13.2 2.5 16v.5h19V16c0-2.8-1.47-5.16-3.9-6.52zM7.5 14.25a1 1 0 110-2 1 1 0 010 2zm9 0a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M16.37 12.55c.03 2.86 2.51 3.81 2.54 3.83-.02.07-.4 1.36-1.31 2.7-.79 1.15-1.61 2.3-2.9 2.32-1.27.03-1.68-.75-3.13-.75-1.46 0-1.91.73-3.12.77-1.25.04-2.2-1.25-3-2.4C3.6 16.7 2.4 13.1 4.1 10.1c.85-1.5 2.37-2.45 4.02-2.48 1.25-.02 2.43.84 3.13.84.7 0 2.13-1.04 3.6-.89.61.03 2.34.25 3.45 1.86-.09.05-2.06 1.2-2.03 3.12zM14.7 5.7c.66-.8 1.1-1.91.98-3.02-1.07.05-2.35.73-3.1 1.58-.67.76-1.26 1.97-1.1 3.12 1.17.09 2.36-.59 3.22-1.68z" />
    </svg>
  );
}

function WeChatOpenGuide({ onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,.78)",
        color: "#fff",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 18,
          textAlign: "right",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: 42, lineHeight: 1, marginBottom: 4 }}>↗</div>
        <div
          style={{
            display: "inline-block",
            maxWidth: 220,
            padding: "10px 12px",
            background: "rgba(255,255,255,.12)",
            borderRadius: 10,
            fontSize: 15,
            lineHeight: 1.55,
            textAlign: "left",
          }}
        >
          点击右上角 <b>···</b>
          <br />
          选择「在浏览器打开」
          <br />
          再点下载 Android 版
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 48,
          textAlign: "center",
          fontSize: 13,
          color: "rgba(255,255,255,.65)",
        }}
      >
        微信内无法直接安装，点空白处关闭
      </div>
    </div>
  );
}
