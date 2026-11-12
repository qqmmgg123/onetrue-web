"use client";

/** @deprecated 房源分享页已下线 */
export default function DownloadAppButton({ downloadUrl, style }) {
  if (!downloadUrl) return null;
  return (
    <a className="btn" href={downloadUrl} style={style}>
      下载 App
    </a>
  );
}
