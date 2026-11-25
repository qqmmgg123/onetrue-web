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

/** 未配置环境变量时的兜底 APK（与七牛覆盖发布路径一致） */
export const DEFAULT_APP_DOWNLOAD_URL =
  "http://storage.otrue.top/app/rent_agent.apk";

export function appDownloadUrl() {
  return (
    (process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL || "").trim() ||
    DEFAULT_APP_DOWNLOAD_URL
  );
}

export function appDownloadHint() {
  return (
    process.env.NEXT_PUBLIC_APP_DOWNLOAD_HINT ||
    "下载醍醐 App（Android）"
  );
}

/** 与 APK 同目录的 version.json */
export function appUpdateManifestUrl(apkUrl = appDownloadUrl()) {
  const raw = (apkUrl || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    u.pathname = u.pathname.replace(/[^/]+$/, "version.json");
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch (_) {
    return "";
  }
}

export function articleSharePath(id) {
  return `/a/${encodeURIComponent(id)}`;
}
