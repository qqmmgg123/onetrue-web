import DownloadAppButton from "../components/DownloadAppButton";
import { appDownloadUrl } from "../lib/room-meta";

export default function Home() {
  const downloadUrl = appDownloadUrl(null);
  const hint =
    process.env.NEXT_PUBLIC_APP_DOWNLOAD_HINT ||
    "已安装则直接打开；未安装请下载缘初 App（Android）";

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 22,
          marginBottom: 8,
        }}
      >
        <img
          src="/app_icon.png"
          alt=""
          width={36}
          height={36}
          style={{ borderRadius: 8, display: "block" }}
        />
        缘初
      </h1>
      <p style={{ color: "#bbb", lineHeight: 1.6 }}>
        打开分享链接可看房间竖屏视频。完整记账、抄表、同步请使用 App。
      </p>
      <p style={{ marginTop: 24, color: "#ddd" }}>{hint}</p>
      {downloadUrl ? (
        <p style={{ marginTop: 16 }}>
          <DownloadAppButton downloadUrl={downloadUrl} />
        </p>
      ) : (
        <p style={{ marginTop: 16, color: "#888", fontSize: 13 }}>
          暂未配置下载地址（需设置 NEXT_PUBLIC_QINIU_PUBLIC_BASE 或
          NEXT_PUBLIC_APP_DOWNLOAD_URL）
        </p>
      )}
      <p style={{ marginTop: 20, color: "#666", fontSize: 12, lineHeight: 1.5 }}>
        若在微信里打开本页：点下载后按提示，从右上角 ···「在浏览器打开」再安装。
      </p>
    </main>
  );
}
