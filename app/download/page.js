import DownloadAppPage from "../../components/DownloadAppPage";
import {
  appDownloadHint,
  appDownloadUrl,
  appUpdateManifestUrl,
  siteOrigin,
} from "../../lib/site";

export const metadata = {
  title: "下载醍醐 App",
  description: "下载并安装醍醐 Android 客户端",
};

export default function DownloadPage() {
  const apkUrl = appDownloadUrl();
  const hint = appDownloadHint();
  const origin = (siteOrigin() || "").replace(/\/+$/, "");
  const pageUrl = origin ? `${origin}/download` : "/download";
  const manifestUrl = appUpdateManifestUrl(apkUrl);

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
