import { corsOptions, proxyToSupabase } from "../../../../../../lib/server/sb-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(request, { params }) {
  const parts = params?.path || [];
  const rest = Array.isArray(parts) ? parts.join("/") : String(parts || "");
  return proxyToSupabase(request, `auth/v1/${rest}`);
}

export const OPTIONS = corsOptions;
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
