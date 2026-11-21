import DownloadAppPage from "../../components/DownloadAppPage";
import { appDownloadHint, appDownloadUrl, siteOrigin } from "../../lib/site";

export const metadata = {
  title: "下载醍醐 App",
  description: "下载并安装醍醐 Android 客户端",
};

export default function DownloadPage() {
  const apkUrl = appDownloadUrl();
  const hint = appDownloadHint();
  const origin = (siteOrigin() || "").replace(/\/+$/, "");
  const pageUrl = origin ? `${origin}/download` : "/download";
  // version.json 与 APK 同目录
  let manifestUrl = "";
  try {
    if (apkUrl) {
      const u = new URL(apkUrl);
      u.pathname = u.pathname.replace(/[^/]+$/, "version.json");
      manifestUrl = u.toString();
    }
  } catch (_) {
    manifestUrl = "";
  }

  return (
    <DownloadAppPage
      apkUrl={apkUrl}
      hint={hint}
      pageUrl={pageUrl}
      manifestUrl={manifestUrl}
      openScheme="yunchu://open"
      androidPackage="com.local.rent.rent_agent"
    />
  );
}
