import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import { hasServerSupabase } from "../../../../lib/server/env";
import { authGetUser } from "../../../../lib/server/supabase";
import {
  NOTE_AI_SYSTEM,
  NOTE_AI_TOOLS,
  parseNoteToolCalls,
} from "../../../../lib/server/note-ai-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function llmConfig() {
  const apiKey = (process.env.LLM_API_KEY || "").trim();
  const base = (process.env.LLM_BASE_URL || "https://api.deepseek.com/v1")
    .trim()
    .replace(/\/+$/, "");
  const model = (process.env.LLM_MODEL || "deepseek-chat").trim();
  return { apiKey, base, model };
}

/**
 * 笔记内 AI：带草稿上下文 + 立刻生效的 draft tools。
 * 服务端只返回 tool_calls，由客户端改编辑器状态（对齐 App）。
 */
export async function POST(request) {
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

  const { apiKey, base, model } = llmConfig();
  if (!apiKey) {
    return NextResponse.json(
      { error: "未配置 LLM_API_KEY，无法使用笔记内 AI" },
      { status: 503 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const userText = String(body?.message || body?.text || "").trim();
  if (!userText) {
    return NextResponse.json({ error: "请输入内容" }, { status: 400 });
  }

  const draft = body?.draft || {};
  const draftCtx = [
    `当前标题：${draft.title || ""}`,
    `当前选项：${
      typeof draft.optionsJson === "string"
        ? draft.optionsJson
        : JSON.stringify(draft.options || {})
    }`,
    "当前正文：",
    String(draft.plain || ""),
  ].join("\n");

  const history = Array.isArray(body?.messages)
    ? body.messages
        .filter((m) => m && (m.role === "user" || m.role === "assistant"))
        .slice(-16)
        .map((m) => ({ role: m.role, content: String(m.content || "") }))
    : [];

  try {
    const upstream = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: body.model || model,
        temperature: 0.2,
        messages: [
          { role: "system", content: NOTE_AI_SYSTEM },
          { role: "system", content: draftCtx },
          ...history,
          { role: "user", content: userText },
        ],
        tools: NOTE_AI_TOOLS,
        tool_choice: "auto",
      }),
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
        {
          error:
            data.error?.message ||
            data.error ||
            data.message ||
            text ||
            "AI 失败",
        },
        { status: upstream.status },
      );
    }
    const msg = data?.choices?.[0]?.message || {};
    const content = String(msg.content || "").trim();
    const toolCalls = parseNoteToolCalls(msg);
    return NextResponse.json({
      reply: content,
      content,
      toolCalls,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "笔记 AI 失败" },
      { status: 502 },
    );
  }
}
