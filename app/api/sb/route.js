import { NextResponse } from "next/server";
import { hasServerSupabase, supabaseUrl } from "../../../lib/server/env";

export const dynamic = "force-dynamic";

/** 部署自检：App 的 SUPABASE_URL 应指向 …/api/sb */
export async function GET() {
  let host = "";
  try {
    host = new URL(supabaseUrl()).host;
  } catch (_) {}
  return NextResponse.json({
    ok: hasServerSupabase(),
    proxy: true,
    upstream: host,
    hint: "App SUPABASE_URL 请设为 https://你的域名/api/sb",
    paths: [
      "/api/sb/auth/v1/*",
      "/api/sb/rest/v1/*",
      "/api/sb/functions/v1/*",
    ],
  });
}
