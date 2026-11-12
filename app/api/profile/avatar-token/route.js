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

/** 浏览器直传七牛用的凭证 */
export async function POST(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "未配置 Supabase" }, { status: 503 });
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
  const ts = Date.now();
  const key = `avatars/${user.id}/${ts}.jpg`;
  return NextResponse.json({
    key,
    token: qiniuUploadToken(key),
    uploadHost: qiniuUploadHost(),
    publicUrl: `${qiniuPublicUrl(key)}?v=${ts}`,
  });
}
