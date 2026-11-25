"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_APP_DOWNLOAD_URL } from "../lib/site";

function isWeChatUA(ua = "") {
  return /MicroMessenger/i.test(ua);
}

function isAndroidUA(ua = "") {
  return /Android/i.test(ua);
}

function isMobileUA(ua = "") {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

/** Chrome Intent：已安装则打开 App，否则走 fallback 下载 */
function buildAndroidIntent({ openScheme, androidPackage, fallbackUrl }) {
  let path = "open";
  try {
    const u = new URL(openScheme);
    path = `${u.host}${u.pathname || ""}${u.search || ""}`.replace(/^\//, "");
  } catch (_) {
    path = "open";
  }
  const scheme = String(openScheme).split("://")[0] || "yunchu";
  const fb = encodeURIComponent(fallbackUrl || "");
  return `intent://${path}#Intent;scheme=${scheme};package=${androidPackage};S.browser_fallback_url=${fb};end`;
}

/**
 * 下载落地页：
 * - 普通浏览器：点安装 → 下 APK；Android 优先 Intent（已装则打开）
 * - 微信内：顶部提示 + 点安装弹出「用浏览器打开」引导
 */
export default function DownloadAppPage({
  apkUrl = "",
  hint = "",
  pageUrl = "",
  manifestUrl = "",
  openScheme = "yunchu://open",
  androidPackage = "com.local.rent.rent_agent",
}) {
  const [ua, setUa] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [meta, setMeta] = useState(null);
  const [selfUrl, setSelfUrl] = useState(pageUrl || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUa(navigator.userAgent || "");
    if (!pageUrl && typeof window !== "undefined") {
      setSelfUrl(window.location.href.split("#")[0]);
    }
  }, [pageUrl]);

  useEffect(() => {
    const urls = [manifestUrl, "http://storage.otrue.top/app/version.json"].filter(
      (u, i, arr) => u && arr.indexOf(u) === i,
    );
    if (!urls.length) return undefined;
    let alive = true;
    (async () => {
      for (const url of urls) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) continue;
          const json = await res.json();
          if (!alive) return;
          setMeta({
            versionName: String(json.versionName || json.version_name || "").trim(),
            versionCode: json.versionCode ?? json.version_code ?? "",
            changelog: String(json.changelog || json.notes || "").trim(),
            updatedAt: String(
              json.publishedAt || json.updatedAt || json.updated_at || json.time || "",
            ).trim(),
            size: String(json.size || json.apkSize || "").trim(),
            apkUrl: String(json.apkUrl || json.apk_url || "").trim(),
          });
          return;
        } catch (_) {
          /* try next */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [manifestUrl]);

  const inWeChat = useMemo(() => isWeChatUA(ua), [ua]);
  const onAndroid = useMemo(() => isAndroidUA(ua), [ua]);
  const onMobile = useMemo(() => isMobileUA(ua), [ua]);

  const downloadHref = (
    meta?.apkUrl ||
    apkUrl ||
    DEFAULT_APP_DOWNLOAD_URL ||
    ""
  ).trim();
  const qrTarget = selfUrl || pageUrl || downloadHref;
  const canInstall = Boolean(downloadHref);

  const qrSrc = useMemo(() => {
    if (!qrTarget) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(qrTarget)}`;
  }, [qrTarget]);

  const startDownload = useCallback(() => {
    if (!downloadHref) return;
    // 跨域 APK：location 跳转比 <a download> 更稳
    window.location.assign(downloadHref);
  }, [downloadHref]);

  const tryOpenApp = useCallback(() => {
    if (!openScheme) return false;
    const t0 = Date.now();
    const timer = window.setTimeout(() => {
      if (Date.now() - t0 < 2800 && !document.hidden) {
        startDownload();
      }
    }, 1600);
    const onHide = () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
    document.addEventListener("visibilitychange", onHide);
    window.location.href = openScheme;
    return true;
  }, [openScheme, startDownload]);

  const onInstallClick = (e) => {
    e.preventDefault();
    if (!downloadHref || busy) return;
    setBusy(true);
    window.setTimeout(() => setBusy(false), 2500);

    if (inWeChat) {
      setGuideOpen(true);
      setBusy(false);
      return;
    }
    if (onAndroid) {
      const intent = buildAndroidIntent({
        openScheme,
        androidPackage,
        fallbackUrl: downloadHref,
      });
      // Intent 可能被拦截：先下发直链兜底，再尝试 Intent
      window.setTimeout(() => {
        if (!document.hidden) startDownload();
      }, 1800);
      try {
        window.location.href = intent;
      } catch (_) {
        startDownload();
      }
      return;
    }
    startDownload();
  };

  const changelogLines = (meta?.changelog || "")
    .split(/\r?\n/)
    .map((s) => s.replace(/^[-•*\d.\s]+/, "").trim())
    .filter(Boolean);

  return (
    <div className={`dl-page${inWeChat ? " is-wechat" : ""}`}>
      {inWeChat ? (
        <div className="dl-wechat-tip" role="note">
          <div className="dl-wechat-tip-text">
            点击右上角按钮，然后在弹出的菜单中，点击在浏览器中打开，即可安装
          </div>
          <div className="dl-wechat-tip-arrow" aria-hidden>
            ↗
          </div>
        </div>
      ) : null}

      <div className="dl-hero-bar" aria-hidden />

      <main className="dl-main">
        <div className="dl-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/app_icon.png" alt="" className="dl-logo" />
          <h1 className="dl-title">醍醐</h1>
          <p className="dl-platform">
            <span className="dl-android-icon" aria-hidden>
              ▣
            </span>
            适用于 Android 设备
          </p>
        </div>

        <div className="dl-qr-wrap">
          {qrSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrSrc} alt="下载页二维码" className="dl-qr" width={220} height={220} />
          ) : (
            <div className="dl-qr dl-qr-empty">暂无下载地址</div>
          )}
        </div>

        <a
          className={`dl-install-btn${busy ? " is-busy" : ""}`}
          href={canInstall ? downloadHref : undefined}
          role="button"
          aria-disabled={!canInstall || busy}
          onClick={onInstallClick}
        >
          {busy ? "正在跳转…" : "安装"}
        </a>

        {!canInstall ? (
          <p className="dl-hint">暂未配置安装包地址，请稍后再试</p>
        ) : null}

        {!inWeChat && onAndroid && openScheme ? (
          <button type="button" className="dl-open-link" onClick={tryOpenApp}>
            已安装？打开 App
          </button>
        ) : null}

        {!onMobile && !inWeChat ? (
          <p className="dl-desktop-hint">手机扫码打开本页，或点击安装下载 APK</p>
        ) : null}

        {hint ? <p className="dl-hint">{hint}</p> : null}

        <section className="dl-about">
          <h2>关于醍醐</h2>
          <dl className="dl-meta">
            {meta?.size ? (
              <>
                <dt>大小</dt>
                <dd>{meta.size}</dd>
              </>
            ) : null}
            {meta?.updatedAt ? (
              <>
                <dt>更新时间</dt>
                <dd>{meta.updatedAt}</dd>
              </>
            ) : null}
            {meta?.versionName ? (
              <>
                <dt>版本</dt>
                <dd>{meta.versionName}</dd>
              </>
            ) : null}
            {meta?.versionCode !== "" && meta?.versionCode != null ? (
              <>
                <dt>Build</dt>
                <dd>{String(meta.versionCode)}</dd>
              </>
            ) : null}
          </dl>
          {changelogLines.length > 0 ? (
            <>
              <h3>更新说明</h3>
              <ul className="dl-changelog">
                {changelogLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="dl-about-text">
              记录念头、备忘与日常，阅读他人分享的文章。Web 与 App 数据互通。
            </p>
          )}
        </section>

        <p className="dl-back">
          <a href="/">返回首页</a>
        </p>
      </main>

      {guideOpen ? (
        <div
          className="dl-guide"
          role="dialog"
          aria-modal="true"
          aria-label="在浏览器中打开"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="dl-guide-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="dl-guide-close"
              aria-label="关闭"
              onClick={() => setGuideOpen(false)}
            >
              ×
            </button>
            <ol className="dl-guide-steps">
              <li>
                <span className="dl-guide-num">1</span>
                请点击右上角
                <span className="dl-guide-dots" aria-hidden>
                  ···
                </span>
              </li>
              <li>
                <span className="dl-guide-num">2</span>
                选择
                <em>「在默认浏览器中打开」</em>
              </li>
            </ol>
            <div className="dl-guide-visual" aria-hidden>
              <div className="dl-guide-bubble">
                <span className="dl-guide-globe">🌐</span>
                <span>在默认浏览器中打开</span>
              </div>
              <p className="dl-guide-note">
                微信内无法直接安装 APK，请用系统浏览器打开后再点「安装」
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
