import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOW_HOST_SUFFIXES = [
  ".clouddn.com",
  ".qiniudn.com",
  ".qnssl.com",
  ".qiniucdn.com",
  ".qbox.me",
];

function hostAllowed(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!h) return false;
  const base = (process.env.QINIU_PUBLIC_BASE || "").trim();
  try {
    if (base) {
      const bu = new URL(base.includes("://") ? base : `https://${base}`);
      if (bu.hostname && h === bu.hostname.toLowerCase()) return true;
    }
  } catch (_) {}
  return ALLOW_HOST_SUFFIXES.some((s) => h === s.slice(1) || h.endsWith(s));
}

/** 同源代理图片，解决 Web HTTPS 下七牛 http 资源混合内容 */
export async function GET(request) {
  const raw = request.nextUrl.searchParams.get("u") || "";
  let target;
  try {
    target = new URL(raw);
  } catch (_) {
    return NextResponse.json({ error: "无效地址" }, { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "不支持的协议" }, { status: 400 });
  }
  if (!hostAllowed(target.hostname)) {
    return NextResponse.json({ error: "域名未允许" }, { status: 403 });
  }
  try {
    const upstream = await fetch(target.toString(), {
      headers: { Accept: "image/*,*/*" },
      cache: "force-cache",
      redirect: "follow",
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `拉取失败 ${upstream.status}` },
        { status: 502 },
      );
    }
    const ctype = upstream.headers.get("content-type") || "image/jpeg";
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ctype,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "代理失败" },
      { status: 502 },
    );
  }
}
