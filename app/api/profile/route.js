import { NextResponse } from "next/server";
import { readAccessToken } from "../../../lib/server/session";
import {
  authGetUser,
  ensureProfileServer,
  fetchProfileServer,
  hasServerSupabase,
} from "../../../lib/server/supabase";
import { restPost } from "../../../lib/server/rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "未配置" }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const token = readAccessToken(request);
  if (!ids.length) {
    return NextResponse.json({ profiles: {} });
  }
  try {
    const list = ids.map(encodeURIComponent).join(",");
    const rows = await (
      await import("../../../lib/server/rest")
    ).restGet(
      `/profiles?select=id,nickname,avatar_url&id=in.(${list})`,
      { accessToken: token },
    );
    const profiles = {};
    for (const r of rows || []) {
      profiles[r.id] = {
        id: r.id,
        nickname: r.nickname || "",
        avatarUrl: r.avatar_url || "",
        displayName:
          (r.nickname || "").trim() || `用户${String(r.id).slice(0, 4)}`,
      };
    }
    return NextResponse.json({ profiles });
  } catch (e) {
    return NextResponse.json({ error: e.message, profiles: {} }, { status: 502 });
  }
}

export async function PATCH(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "未配置" }, { status: 503 });
  }
  const token = readAccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const user = await authGetUser(token);
  if (!user?.id) {
    return NextResponse.json({ error: "登录失效" }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }
  const payload = {
    id: user.id,
    updated_at: new Date().toISOString(),
  };
  if (body.nickname != null) payload.nickname = String(body.nickname).trim();
  if (body.avatarUrl != null) payload.avatar_url = String(body.avatarUrl).trim();

  try {
    await ensureProfileServer(token, user, payload.nickname || "");
    const rows = await restPost("/profiles?on_conflict=id", payload, {
      accessToken: token,
      prefer: "resolution=merge-duplicates,return=representation",
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    const profile = row
      ? {
          id: row.id,
          nickname: row.nickname || "",
          avatarUrl: row.avatar_url || "",
          displayName:
            (row.nickname || "").trim() ||
            `用户${String(row.id).slice(0, 4)}`,
        }
      : await fetchProfileServer(user.id, token);
    return NextResponse.json({ profile });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
