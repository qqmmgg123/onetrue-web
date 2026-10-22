async function loadMeta(id) {
  const base = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE || "").replace(/\/+$/, "");
  if (!base || !id) return { base, meta: null, videoUrl: "" };

  const metaUrl = `${base}/rooms/${id}/meta.json`;
  try {
    const res = await fetch(metaUrl, { next: { revalidate: 30 } });
    if (res.ok) {
      const meta = await res.json();
      return {
        base,
        meta,
        videoUrl: meta.videoUrl || `${base}/rooms/${id}/video.mp4`,
      };
    }
  } catch {
    // fall through：没有 meta 时仍尝试直接播 video.mp4
  }

  const videoUrl = `${base}/rooms/${id}/video.mp4`;
  try {
    const head = await fetch(videoUrl, {
      method: "HEAD",
      next: { revalidate: 30 },
    });
    if (head.ok || head.status === 206) {
      return { base, meta: null, videoUrl };
    }
  } catch {
    // ignore
  }

  return { base, meta: null, videoUrl: "" };
}

function yuan(n) {
  const v = Number(n) || 0;
  return `¥${v.toFixed(v % 1 === 0 ? 0 : 2)}`;
}

export default async function RoomSharePage({ params }) {
  const id = params?.id || "";
  const { base, meta, videoUrl } = await loadMeta(id);
  const downloadUrl =
    meta?.appDownloadUrl || process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL || "";
  const hint =
    meta?.appDownloadHint ||
    process.env.NEXT_PUBLIC_APP_DOWNLOAD_HINT ||
    "App 下载方式稍后公布";

  if (!base) {
    return (
      <main style={styles.wrap}>
        <p style={{ color: "#ccc", textAlign: "center", padding: 32 }}>
          分享站未配置 R2 公开地址（Vercel 环境变量 NEXT_PUBLIC_R2_PUBLIC_BASE）。
        </p>
        <Footer hint={hint} downloadUrl={downloadUrl} />
      </main>
    );
  }

  if (!videoUrl) {
    return (
      <main style={styles.wrap}>
        <p style={{ color: "#ccc", textAlign: "center", padding: 32 }}>
          还没有这个房间的视频，或链接已失效。
        </p>
        <Footer hint={hint} downloadUrl={downloadUrl} />
      </main>
    );
  }

  const title = meta
    ? [meta.propertyName, meta.roomLabel].filter(Boolean).join(" · ")
    : "房间视频";
  const line2 = meta
    ? meta.tenantName
      ? `${meta.tenantName} · 月租 ${yuan(meta.rent)}`
      : `空房 · 月租 ${yuan(meta.rent)}`
    : "";

  return (
    <main style={styles.wrap}>
      <div style={styles.stage}>
        <video
          src={videoUrl}
          poster={meta?.posterUrl || undefined}
          controls
          playsInline
          autoPlay
          loop
          muted
          style={styles.video}
        />
        <div style={styles.overlay}>
          <div style={styles.title}>{title}</div>
          {line2 ? <div style={styles.price}>{line2}</div> : null}
          {meta?.propertyAddress ? (
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
