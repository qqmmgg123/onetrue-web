"use client";

/**
 * HTTPS 站点加载七牛测试域 http 图会被浏览器拦截（混合内容）。
 * 统一走同源代理展示。
 */
export function mediaDisplayUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (typeof window === "undefined") return raw;
  try {
    const u = new URL(raw, window.location.origin);
    const pageHttps = window.location.protocol === "https:";
    if (pageHttps && u.protocol === "http:") {
      return `/api/media/proxy?u=${encodeURIComponent(u.toString())}`;
    }
    return u.toString();
  } catch (_) {
    return raw;
  }
}
