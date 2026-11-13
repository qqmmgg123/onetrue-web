import { NextResponse } from "next/server";
import {
  clearSessionCookies,
  readAccessToken,
  readSessionFromCookies,
  setSessionCookies,
} from "../../../../lib/server/session";
import {
  authGetUser,
  authRefreshGrant,
  fetchProfileServer,
  hasServerSupabase,
} from "../../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function profileFor(user, token) {
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
  return profile;
}

export async function GET(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { user: null, profile: null, configured: false },
      { status: 200 },
    );
  }

  let token = readAccessToken(request);
  let refreshed = null;

  let user = token ? await authGetUser(token) : null;

  // access 失效时尝试 refresh（Cookie 或仅剩 refresh）
  if (!user?.id) {
    const rt =
      readSessionFromCookies()?.refreshToken ||
      "";
    if (rt) {
      try {
        refreshed = await authRefreshGrant(rt);
        token = refreshed.access_token || "";
        user = refreshed.user || (token ? await authGetUser(token) : null);
      } catch (_) {
        refreshed = null;
        user = null;
      }
    }
  }

  if (!user?.id) {
    const res = NextResponse.json({
      user: null,
      profile: null,
      configured: true,
    });
    // 有过期残留 Cookie 时清掉
    if (token || readSessionFromCookies()?.refreshToken) {
      clearSessionCookies(res);
    }
    return res;
  }

  try {
    const profile = await profileFor(user, token);
    const payload = {
      configured: true,
      user: { id: user.id, email: user.email || "" },
      profile,
    };
    if (refreshed?.access_token) {
      payload.tokens = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || "",
        expires_at:
          refreshed.expires_at ||
          Math.floor(Date.now() / 1000) + (refreshed.expires_in || 3600),
      };
    }
    const res = NextResponse.json(payload);
    if (refreshed?.access_token) {
      setSessionCookies(res, refreshed, request);
    }
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "会话无效", user: null, profile: null },
      { status: 401 },
    );
  }
}
