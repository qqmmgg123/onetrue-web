import { NextResponse } from "next/server";
import {
  hasServerSupabase,
  supabaseAnonKey,
  supabaseUrl,
} from "./env";

/**
 * 把请求转发到真实 Supabase（auth / rest / functions）。
 * @param {Request} request
 * @param {string} subPath 如 auth/v1/token 或 rest/v1/notes
 */
export async function proxyToSupabase(request, subPath) {
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "gateway supabase not configured" },
      { status: 503 },
    );
  }

  const incoming = new URL(request.url);
  const target = `${supabaseUrl()}/${subPath.replace(/^\/+/, "")}${incoming.search}`;

  const headers = new Headers();
  for (const name of [
    "authorization",
    "content-type",
    "accept",
    "prefer",
    "x-client-info",
    "x-supabase-api-version",
  ]) {
    const v = request.headers.get(name);
    if (v) headers.set(name, v);
  }
  headers.set("apikey", supabaseAnonKey());
  if (!headers.has("authorization")) {
    headers.set("Authorization", `Bearer ${supabaseAnonKey()}`);
  }

  const method = request.method.toUpperCase();
  let body;
  if (method !== "GET" && method !== "HEAD") {
    const buf = await request.arrayBuffer();
    body = buf.byteLength ? buf : undefined;
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e.message || "upstream fetch failed",
        target: target.replace(/\?.*$/, ""),
      },
      { status: 502 },
    );
  }

  const outHeaders = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) outHeaders.set("content-type", ct);
  outHeaders.set("Access-Control-Allow-Origin", "*");
  outHeaders.set(
    "Access-Control-Allow-Headers",
    "authorization, apikey, content-type, prefer, x-client-info",
  );
  outHeaders.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: outHeaders,
  });
}

export function corsOptions() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, prefer, x-client-info",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    },
  });
}
