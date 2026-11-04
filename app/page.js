import { appDownloadUrl } from "../lib/room-meta";

export default function Home() {
  const downloadUrl = appDownloadUrl(null);
  const hint =
    process.env.NEXT_PUBLIC_APP_DOWNLOAD_HINT ||
    "点击下载缘初 App（Android）";

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
          <a
            href={downloadUrl}
            download
            style={{
              display: "inline-block",
              padding: "10px 16px",
              border: "1px solid rgba(255,255,255,.55)",
              borderRadius: 8,
              color: "#fff",
              textDecoration: "none",
              fontSize: 15,
            }}
          >
            下载缘初 AI 推广助手
          </a>
        </p>
      ) : (
        <p style={{ marginTop: 16, color: "#888", fontSize: 13 }}>
          暂未配置下载地址（需设置 NEXT_PUBLIC_QINIU_PUBLIC_BASE 或
          NEXT_PUBLIC_APP_DOWNLOAD_URL）
        </p>
      )}
    </main>
  );
}
