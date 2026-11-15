import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import { hasServerSupabase } from "../../../../lib/server/env";
import { authGetUser } from "../../../../lib/server/supabase";
import {
  NOTE_AI_SYSTEM,
  NOTE_AI_TOOLS,
  parseNoteToolCalls,
} from "../../../../lib/server/note-ai-tools";
import { callChatWithFailover } from "../../../../lib/server/llm-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const { data } = await callChatWithFailover({
      messages: [
        { role: "system", content: NOTE_AI_SYSTEM },
        { role: "system", content: draftCtx },
        ...history,
        { role: "user", content: userText },
      ],
      tools: NOTE_AI_TOOLS,
      modelOverride: body.model,
      temperature: 0.2,
    });
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
      {
        error:
          e.message ||
          "笔记 AI 失败。请在 EdgeOne 配置 ZHIPU_API_KEY（推荐）",
      },
      { status: e.status || 502 },
    );
  }
}
