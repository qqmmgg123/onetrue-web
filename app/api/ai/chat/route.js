import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import {
  hasServerSupabase,
  supabaseAnonKey,
  supabaseUrl,
} from "../../../../lib/server/env";
import { authGetUser } from "../../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Web/App：经网关调用 Edge llm-chat，客户端不直连 supabase.co */
export async function POST(request) {
  if (!hasServerSupabase()) {
    return NextResponse.json({ error: "服务端未配置 Supabase" }, { status: 503 });
  }
  const token = readAccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const user = await authGetUser(token);
  if (!user?.id) {
    return NextResponse.json({ error: "登录已失效" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  // 兼容 Web 简化 messages 与 OpenAI chat/completions 体
  let upstreamBody = body;
  if (Array.isArray(body?.messages) && !body.model && body.temperature == null) {
    upstreamBody = {
      temperature: 0.3,
      messages: body.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };
  }

  try {
    const upstream = await fetch(`${supabaseUrl()}/functions/v1/llm-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey(),
      },
      body: JSON.stringify(upstreamBody),
    });
    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { raw: text };
    }
    if (!upstream.ok) {
      return NextResponse.json(
        { error: data.error || data.message || text || "AI 失败" },
        { status: upstream.status },
      );
    }

    const content =
      data?.reply ||
      data?.content ||
      data?.message ||
      data?.choices?.[0]?.message?.content ||
      "";

    // 同时返回 OpenAI 形态与简化 reply，方便 App / Web
    return NextResponse.json({
      ...data,
      reply: content,
      content,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "AI 上游失败" },
      { status: 502 },
    );
  }
}
