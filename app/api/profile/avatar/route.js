import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import {
  authGetUser,
  hasServerSupabase,
} from "../../../../lib/server/supabase";
import { restPost } from "../../../../lib/server/rest";
import { qiniuConfigured, qiniuPutBytes } from "../../../../lib/server/qiniu";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "未配置 Supabase" }, { status: 503 });
  }
  if (!qiniuConfigured()) {
    return NextResponse.json(
      { error: "服务端未配置七牛，无法上传头像" },
      { status: 503 },
    );
  }
  const token = readAccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const user = await authGetUser(token);
  if (!user?.id) {
    return NextResponse.json({ error: "登录失效" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "请选择图片" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "头像请小于 2MB" }, { status: 400 });
  }
  const ts = Date.now();
  const key = `avatars/${user.id}/${ts}.jpg`;
  try {
    const url = await qiniuPutBytes(key, buf, file.type || "image/jpeg");
    const avatarUrl = `${url}${url.includes("?") ? "&" : "?"}v=${ts}`;
    const rows = await restPost(
      "/profiles?on_conflict=id",
      {
        id: user.id,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      },
      {
        accessToken: token,
        prefer: "resolution=merge-duplicates,return=representation",
      },
    );
    const row = Array.isArray(rows) ? rows[0] : rows;
    return NextResponse.json({
      avatarUrl,
      profile: row
        ? {
            id: row.id,
            nickname: row.nickname || "",
            avatarUrl: row.avatar_url || avatarUrl,
            displayName:
              (row.nickname || "").trim() ||
              `用户${String(row.id).slice(0, 4)}`,
          }
        : { id: user.id, avatarUrl, nickname: "", displayName: "用户" },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "上传失败" }, { status: 502 });
  }
}
