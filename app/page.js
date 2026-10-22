export default function Home() {
  const downloadUrl = process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL || "";
  const hint =
    process.env.NEXT_PUBLIC_APP_DOWNLOAD_HINT ||
    "App 下载方式稍后公布";

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>收租助手</h1>
      <p style={{ color: "#bbb", lineHeight: 1.6 }}>
        打开分享链接可看房间竖屏视频。完整记账、抄表、同步请使用 App。
      </p>
      <p style={{ marginTop: 24, color: "#ddd" }}>{hint}</p>
      {downloadUrl ? (
        <p style={{ marginTop: 12 }}>
          <a href={downloadUrl} style={{ color: "#8ec7ff" }}>
            下载 App
          </a>
        </p>
      ) : null}
    </main>
  );
}
