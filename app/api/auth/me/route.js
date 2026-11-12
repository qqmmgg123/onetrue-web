import { NextResponse } from "next/server";
import {
  clearSessionCookies,
  readAccessToken,
} from "../../../../lib/server/session";
import {
  authGetUser,
  fetchProfileServer,
  hasServerSupabase,
} from "../../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { user: null, profile: null, configured: false },
      { status: 200 },
    );
  }

  const token = readAccessToken(request);
  if (!token) {
    return NextResponse.json({
      user: null,
      profile: null,
      configured: true,
    });
  }

  try {
    const user = await authGetUser(token);
    if (!user?.id) {
      const res = NextResponse.json({
        user: null,
        profile: null,
        configured: true,
      });
      clearSessionCookies(res);
      return res;
    }
    let profile = null;
    try {
      profile = await fetchProfileServer(user.id, token);
    } catch (_) {}
    if (!profile) {
      profile = {
        id: user.id,
        nickname: "",
        avatarUrl: "",
        displayName: `用户${String(user.id).slice(0, 4)}`,
      };
    }
    return NextResponse.json({
      configured: true,
      user: { id: user.id, email: user.email || "" },
      profile,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "会话无效", user: null, profile: null },
      { status: 401 },
    );
  }
}
