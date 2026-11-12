import { NextResponse } from "next/server";
import { supabaseUrl } from "../../../lib/server/env";
import {
  hasServerSupabase,
  restGet,
} from "../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 试点探活：EdgeOne/本机 → Supabase 是否通 */
export async function GET() {
  if (!hasServerSupabase()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        gateway: "next",
        supabase: false,
        error: "未配置 SUPABASE_URL / ANON_KEY",
      },
      { status: 503 },
    );
  }

  const started = Date.now();
  const host = (() => {
    try {
      return new URL(supabaseUrl()).host;
    } catch (_) {
      return "";
    }
  })();

  try {
    // 轻量请求：listed 文章 1 条（anon RLS 可读）
    await restGet(
      "/notes?select=id&kind=eq.article&listing_status=eq.listed&deleted_at=is.null&limit=1",
    );
    return NextResponse.json({
      ok: true,
      configured: true,
      gateway: "next",
      supabase: true,
      host,
      latencyMs: Date.now() - started,
    });
  } catch (e) {
    const cause = e?.cause?.message || e?.cause?.code || "";
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        gateway: "next",
        supabase: false,
        host,
        latencyMs: Date.now() - started,
        error: e.message || "upstream failed",
        cause: cause || undefined,
        hint:
          "本机/当前网络若直连 Supabase 失败属预期；部署到 EdgeOne 后再测 /api/health。客户端应只访问本站域名。",
      },
      { status: 502 },
    );
  }
}
