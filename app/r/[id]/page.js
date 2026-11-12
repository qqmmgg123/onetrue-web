import { redirect } from "next/navigation";

/** 旧房间视频分享路径已下线，重定向到首页 */
export default function LegacyRoomRedirect() {
  redirect("/");
}
