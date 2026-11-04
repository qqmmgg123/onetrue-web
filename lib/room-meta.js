/** 媒体公开前缀：优先七牛，其次通用 MEDIA，再 R2 */
export function mediaPublicBase() {
  return (
    process.env.NEXT_PUBLIC_QINIU_PUBLIC_BASE ||
    process.env.NEXT_PUBLIC_MEDIA_PUBLIC_BASE ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE ||
    ""
  ).replace(/\/+$/, "");
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

/** @returns {Promise<{ base: string, meta: object|null, videoUrl: string, posterUrl: string }>} */
export async function loadMeta(id) {
  const base = mediaPublicBase();
  if (!base || !id) {
    return { base, meta: null, videoUrl: "", posterUrl: "" };
  }

  const metaUrl = `${base}/rooms/${id}/meta.json`;
  try {
    const res = await fetch(metaUrl, { next: { revalidate: 30 } });
    if (res.ok) {
      const meta = await res.json();
      return {
        base,
        meta,
        videoUrl: meta.videoUrl || `${base}/rooms/${id}/video.mp4`,
        posterUrl: meta.posterUrl || "",
      };
    }
  } catch {
    // fall through
  }

  const videoUrl = `${base}/rooms/${id}/video.mp4`;
  try {
    const head = await fetch(videoUrl, {
      method: "HEAD",
      next: { revalidate: 30 },
    });
    if (head.ok || head.status === 206) {
      return { base, meta: null, videoUrl, posterUrl: "" };
    }
  } catch {
    // ignore
  }

  return { base, meta: null, videoUrl: "", posterUrl: "" };
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
