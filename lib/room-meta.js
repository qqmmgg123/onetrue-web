/** @deprecated 房源视频分享已下线；保留空壳避免旧引用报错 */
export { siteOrigin } from "./site";

export function mediaPublicBase() {
  return "";
}

export function mediaPublicBases() {
  return [];
}

export function appDownloadUrl() {
  return (process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL || "").trim();
}

export async function loadMeta() {
  return { meta: null, videoUrl: "", posterUrl: "", tried: [] };
}
