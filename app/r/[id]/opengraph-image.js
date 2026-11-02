import { ImageResponse } from "next/og";
import { loadMeta, cardCopy, yuan } from "../../../lib/room-meta";

export const runtime = "edge";
export const alt = "房间视频分享卡片";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }) {
  const id = params?.id || "";
  const { meta, posterUrl } = await loadMeta(id);
  const { title } = cardCopy(meta, id);
  const rent = meta ? yuan(meta.rent) : "";
  const sub = meta?.tenantName
    ? `${meta.tenantName} · 月租 ${rent}`
    : rent
      ? `月租 ${rent}`
      : "实拍房间视频";
  const addr = meta?.propertyAddress || "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          background: "#0a0a0a",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: "46%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: posterUrl
              ? `linear-gradient(160deg,#1a1a1a,#111)`
              : "linear-gradient(160deg,#1f2937,#0f172a)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterUrl}
              alt=""
              width={552}
              height={630}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
                opacity: 0.9,
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 96,
                  border: "4px solid rgba(255,255,255,0.85)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 42,
                }}
              >
                ▶
              </div>
              <div style={{ fontSize: 28, color: "rgba(255,255,255,0.8)" }}>
                房间实拍
              </div>
            </div>
          )}
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "48px 56px",
            background: "linear-gradient(135deg,#111827 0%,#000 100%)",
          }}
        >
          <div
            style={{
              fontSize: 22,
              letterSpacing: 4,
              color: "#93c5fd",
              marginBottom: 20,
            }}
          >
            缘初 · 房间视频
          </div>
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1.2,
              marginBottom: 24,
              maxWidth: 560,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 36, fontWeight: 600, color: "#f8fafc" }}>
            {sub}
          </div>
          {addr ? (
            <div
              style={{
                marginTop: 18,
                fontSize: 24,
                color: "rgba(255,255,255,0.65)",
                maxWidth: 560,
              }}
            >
              {addr}
            </div>
          ) : null}
          <div
            style={{
              marginTop: 40,
              fontSize: 20,
              color: "rgba(255,255,255,0.45)",
            }}
          >
            点击查看完整竖屏视频
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
