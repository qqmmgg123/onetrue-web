export function siteOrigin() {
  const explicit = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  if (explicit) return explicit;
  if (process.env.NEXT_PUBLIC_SHARE_WEB_BASE) {
    return String(process.env.NEXT_PUBLIC_SHARE_WEB_BASE).replace(/\/+$/, "");
  }
  if (process.env.EDGEONE_SITE_URL) {
    return String(process.env.EDGEONE_SITE_URL).replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

export function appDownloadUrl() {
  return (process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL || "").trim();
}

export function appDownloadHint() {
  return (
    process.env.NEXT_PUBLIC_APP_DOWNLOAD_HINT ||
    "下载醍醐 App（Android）"
  );
}

export function articleSharePath(id) {
  return `/a/${encodeURIComponent(id)}`;
}
