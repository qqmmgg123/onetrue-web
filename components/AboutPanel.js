"use client";

import { appDownloadHint } from "../lib/site";

/** 「其他 → 关于我们」 */
export default function AboutPanel() {
  const hint = appDownloadHint();
  return (
    <div className="panel about-panel">
      <div className="about-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/app_icon.png" alt="" className="about-logo" />
        <h2>醍醐</h2>
      </div>
      <p className="hint">
        记录念头、备忘与日常，阅读他人分享的文章。Web 与 App 数据互通。
      </p>
      <p style={{ marginTop: 16 }}>
        <a className="btn" href="/download">
          {hint || "下载 App"}
        </a>
      </p>
    </div>
  );
}
