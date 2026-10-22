async function loadMeta(id) {
  const base = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE || "").replace(/\/+$/, "");
  if (!base || !id) return null;
  const url = `${base}/rooms/${id}/meta.json`;
  try {
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function yuan(n) {
  const v = Number(n) || 0;
  return `¥${v.toFixed(v % 1 === 0 ? 0 : 2)}`;
}

export default async function RoomSharePage({ params }) {
  const id = params?.id || "";
  const meta = await loadMeta(id);
  const downloadUrl =
    meta?.appDownloadUrl || process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL || "";
  const hint =
    meta?.appDownloadHint ||
    process.env.NEXT_PUBLIC_APP_DOWNLOAD_HINT ||
    "App 下载方式稍后公布";

  if (!meta) {
    return (
      <main style={styles.wrap}>
        <p style={{ color: "#ccc", textAlign: "center", padding: 32 }}>
          还没有这个房间的视频，或链接已失效。
        </p>
        <Footer hint={hint} downloadUrl={downloadUrl} />
      </main>
    );
  }

  const title = [meta.propertyName, meta.roomLabel].filter(Boolean).join(" · ");
  const line2 = meta.tenantName
    ? `${meta.tenantName} · 月租 ${yuan(meta.rent)}`
    : `空房 · 月租 ${yuan(meta.rent)}`;

  return (
    <main style={styles.wrap}>
      <div style={styles.stage}>
        {meta.videoUrl ? (
          <video
            src={meta.videoUrl}
            poster={meta.posterUrl || undefined}
            controls
            playsInline
            autoPlay
            loop
            muted
            style={styles.video}
          />
        ) : (
          <p style={{ color: "#aaa" }}>暂无视频</p>
        )}
        <div style={styles.overlay}>
          <div style={styles.title}>{title}</div>
          <div style={styles.price}>{line2}</div>
          {meta.propertyAddress ? (
            <div style={styles.addr}>{meta.propertyAddress}</div>
          ) : null}
        </div>
      </div>
      <Footer hint={hint} downloadUrl={downloadUrl} />
    </main>
  );
}

function Footer({ hint, downloadUrl }) {
  return (
    <footer style={styles.footer}>
      <div style={{ color: "#aaa", fontSize: 13 }}>{hint}</div>
      {downloadUrl ? (
        <a href={downloadUrl} style={{ color: "#8ec7ff", fontSize: 14 }}>
          下载收租助手 App
        </a>
      ) : null}
    </footer>
  );
}

const styles = {
  wrap: {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    background: "#000",
  },
  stage: {
    position: "relative",
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#111",
    minHeight: "70dvh",
  },
  video: {
    width: "100%",
    height: "100%",
    maxHeight: "85dvh",
    objectFit: "contain",
    background: "#000",
  },
  overlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    textShadow: "0 2px 8px rgba(0,0,0,.7)",
  },
  title: { fontSize: 16, fontWeight: 600, marginBottom: 4 },
  price: { fontSize: 22, fontWeight: 700 },
  addr: { marginTop: 4, color: "rgba(255,255,255,.75)", fontSize: 13 },
  footer: {
    padding: "12px 16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    borderTop: "1px solid #222",
  },
};
