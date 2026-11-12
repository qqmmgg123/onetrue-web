import { NextResponse } from "next/server";
import {
  clearSessionCookies,
  readAccessToken,
} from "../../../../lib/server/session";
import { authSignOut } from "../../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  const token = readAccessToken(request);
  try {
    await authSignOut(token);
  } catch (_) {}
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  return res;
}
