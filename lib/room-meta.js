/** 媒体公开前缀：优先七牛，其次通用 MEDIA，再 R2 */
export function mediaPublicBase() {
  return mediaPublicBases()[0] || "";
}

/** 所有已配置的媒体前缀（按优先级），用于分享页逐个回退查找 */
export function mediaPublicBases() {
  const raw = [
    process.env.NEXT_PUBLIC_QINIU_PUBLIC_BASE,
    process.env.NEXT_PUBLIC_MEDIA_PUBLIC_BASE,
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE,
  ];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const base = (item || "").trim().replace(/\/+$/, "");
    if (!base || seen.has(base)) continue;
    seen.add(base);
    out.push(base);
  }
  return out;
}

/** @deprecated 用 mediaPublicBase */
export function r2PublicBase() {
  return mediaPublicBase();
}

export function siteOrigin() {
  const explicit = (process.env.NEXT_PUBLIC_SHARE_WEB_BASE || "").replace(
    /\/+$/,
    "",
  );
  if (explicit) return explicit;
  // EdgeOne / 部分平台注入的站点 URL
  if (process.env.EDGEONE_SITE_URL) {
    return String(process.env.EDGEONE_SITE_URL).replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

export function yuan(n) {
  const v = Number(n) || 0;
  return `¥${v.toFixed(v % 1 === 0 ? 0 : 2)}`;
}

/**
 * @returns {Promise<{
 *   base: string,
 *   meta: object|null,
 *   videoUrl: string,
 *   posterUrl: string,
 *   tried: string[],
 * }>}
 */
export async function loadMeta(id) {
  const bases = mediaPublicBases();
  const tried = [];
  if (!id || bases.length === 0) {
    return { base: bases[0] || "", meta: null, videoUrl: "", posterUrl: "", tried };
  }

  for (const base of bases) {
    const metaUrl = `${base}/rooms/${id}/meta.json`;
    tried.push(metaUrl);
    try {
      const res = await fetch(metaUrl, {
        cache: "no-store",
        next: { revalidate: 0 },
      });
      if (res.ok) {
        const meta = await res.json();
        const videoUrl = (meta.videoUrl || "").trim() || `${base}/rooms/${id}/video.mp4`;
        const posterUrl = (meta.posterUrl || "").trim();
        return { base, meta, videoUrl, posterUrl, tried };
      }
    } catch {
      // try next base
    }

    // 旧版固定路径兜底（无 meta 时）
    const legacyVideo = `${base}/rooms/${id}/video.mp4`;
    tried.push(legacyVideo);
    try {
      const head = await fetch(legacyVideo, {
        method: "HEAD",
        cache: "no-store",
        next: { revalidate: 0 },
      });
      if (head.ok || head.status === 206) {
        return { base, meta: null, videoUrl: legacyVideo, posterUrl: "", tried };
      }
    } catch {
      // ignore
    }
  }

  return {
    base: bases[0] || "",
    meta: null,
    videoUrl: "",
    posterUrl: "",
    tried,
  };
}

/** 分享页底部下载链接：meta > 显式环境变量 > 七牛默认 APK 路径 */
export function appDownloadUrl(meta) {
  const fromMeta = (meta?.appDownloadUrl || "").trim();
  if (fromMeta) return fromMeta;
  const fromEnv = (process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL || "").trim();
  if (fromEnv) return fromEnv;
  const base = mediaPublicBase();
  return base ? `${base}/app/rent_agent.apk` : "";
}

export function cardCopy(meta, id) {
  const title = meta
    ? [meta.propertyName, meta.roomLabel].filter(Boolean).join(" · ") ||
      "房间视频"
    : "房间视频";
  const rentLine = meta
    ? meta.tenantName
      ? `${meta.tenantName} · 月租 ${yuan(meta.rent)}`
      : `空房 · 月租 ${yuan(meta.rent)}`
    : "点击查看房间实拍视频";
  const description = [rentLine, meta?.propertyAddress]
    .filter(Boolean)
    .join(" · ");
  return { title, description: description || "房间实拍短视频" };
}
