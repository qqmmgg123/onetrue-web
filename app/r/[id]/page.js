import {
  loadMeta,
  cardCopy,
  siteOrigin,
  yuan,
  appDownloadUrl,
} from "../../../lib/room-meta";

export async function generateMetadata({ params }) {
  const id = params?.id || "";
  const { meta, videoUrl, posterUrl } = await loadMeta(id);
  const { title, description } = cardCopy(meta, id);
  const origin = siteOrigin();
  const pageUrl = origin ? `${origin}/r/${id}` : undefined;
  // 优先用动态 OG 图（本站 /opengraph-image）；有封面时也写进 images 作兜底
  const images = posterUrl
    ? [{ url: posterUrl, width: 720, height: 1280, alt: title }]
    : undefined;

  return {
    title: `${title} · 缘初`,
    description,
    alternates: pageUrl ? { canonical: pageUrl } : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "zh_CN",
      url: pageUrl,
      siteName: "缘初",
      images,
      videos: videoUrl
        ? [
            {
              url: videoUrl,
              type: "video/mp4",
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: posterUrl ? [posterUrl] : undefined,
    },
    other: {
      // 微信等爬虫常用
      "og:image:alt": title,
    },
  };
}

export default async function RoomSharePage({ params }) {
  const id = params?.id || "";
  const { base, meta, videoUrl } = await loadMeta(id);
  const downloadUrl = appDownloadUrl(meta);
  const hint =
    meta?.appDownloadHint ||
    process.env.NEXT_PUBLIC_APP_DOWNLOAD_HINT ||
    "点击下载缘初 App（Android）";

  if (!base) {
    return (
      <main style={styles.wrap}>
        <p style={{ color: "#ccc", textAlign: "center", padding: 32 }}>
          分享站未配置媒体公开地址（EdgeOne 环境变量 NEXT_PUBLIC_QINIU_PUBLIC_BASE
          或 NEXT_PUBLIC_R2_PUBLIC_BASE）。
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

  const { title } = cardCopy(meta, id);
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
        <a
          href={downloadUrl}
          download
          style={{
            display: "inline-block",
            marginTop: 4,
            padding: "8px 12px",
            border: "1px solid rgba(255,255,255,.45)",
            borderRadius: 8,
            color: "#fff",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          下载缘初 AI 推广助手
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
