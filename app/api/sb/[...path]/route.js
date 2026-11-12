import { corsOptions, proxyToSupabase } from "../../../../lib/server/sb-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 兜底 catch-all（部分平台对深层 [...path] 支持更好时走显式 auth/rest/functions 路由） */
async function handle(request, { params }) {
  const parts = params?.path || [];
  const subPath = Array.isArray(parts) ? parts.join("/") : String(parts || "");
  if (!subPath) {
    return Response.json({ error: "missing path" }, { status: 400 });
  }
  return proxyToSupabase(request, subPath);
}

export const OPTIONS = corsOptions;
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
