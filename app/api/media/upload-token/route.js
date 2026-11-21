import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import { authGetUser, hasServerSupabase } from "../../../../lib/server/supabase";
import {
  qiniuConfigured,
  qiniuPublicUrl,
  qiniuUploadHost,
  qiniuUploadToken,
} from "../../../../lib/server/qiniu";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 文章封面 / 正文插图：浏览器直传七牛凭证 */
export async function POST(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "未配置" }, { status: 503 });
  }
  if (!qiniuConfigured()) {
    return NextResponse.json(
      { error: "服务端未配置七牛（请在 EdgeOne 配置 QINIU_*）" },
      { status: 503 },
    );
  }
  const access = readAccessToken(request);
  if (!access) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const user = await authGetUser(access);
  if (!user?.id) {
    return NextResponse.json({ error: "登录失效" }, { status: 401 });
  }
  let body = {};
  try {
    body = await request.json();
  } catch (_) {}
  const kind = String(body.kind || body.folder || "note-images").trim();
  const folder = kind === "covers" ? "covers" : "note-images";
  const ts = Date.now();
  const key = `${folder}/${user.id}/${ts}.jpg`;
  return NextResponse.json({
    key,
    token: qiniuUploadToken(key),
    uploadHost: qiniuUploadHost(),
    publicUrl: `${qiniuPublicUrl(key)}?v=${ts}`,
  });
}
