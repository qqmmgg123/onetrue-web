"use client";

import { appDownloadHint, appDownloadUrl } from "../lib/site";

/** 客服与联系（其他 → 侧栏第二项） */
export default function SupportPanel() {
  const download = appDownloadUrl();
  return (
    <div className="panel" style={{ maxWidth: 560 }}>
      <h2>客服和联系</h2>
      <p className="hint">
        使用问题、账号与上架相关，可通过下方方式联系我们。
      </p>
      <div className="settings-list">
        <div className="row">
          <span>邮箱</span>
          <span className="sub">support@tihu.app</span>
        </div>
        <div className="row">
          <span>反馈</span>
          <span className="sub">在 App「其他」也可提交</span>
        </div>
        {download ? (
          <a href={download} target="_blank" rel="noreferrer">
            <span>{appDownloadHint()}</span>
            <span className="sub">下载</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
