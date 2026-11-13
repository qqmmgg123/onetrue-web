import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import {
  hasServerSupabase,
  supabaseAnonKey,
  supabaseUrl,
} from "../../../../lib/server/env";
import { authGetUser } from "../../../../lib/server/supabase";
import {
  SYSTEM_PROMPT,
  TOOL_SCHEMAS,
  WRITE_TOOLS,
  listNotesText,
  makePending,
  parseToolCall,
} from "../../../../lib/server/ai-tools";

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

async function callUpstream({ apiKey, base, model, messages, tools }) {
  const chatBody = {
    model,
    temperature: 0.3,
    messages,
  };
  if (tools?.length) {
    chatBody.tools = tools;
    chatBody.tool_choice = "auto";
  }
  const upstream = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(chatBody),
  });
  const text = await upstream.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = { raw: text };
  }
  if (!upstream.ok) {
    const err = new Error(
      data.error?.message ||
        data.error ||
        data.message ||
        text ||
        "AI 失败",
    );
    err.status = upstream.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** 优先本机直连 LLM（含 tools）；失败再试无 tools 的 Edge Function 闲聊 */
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

  const messages = Array.isArray(body?.messages)
    ? body.messages
        .filter((m) => m && (m.role === "user" || m.role === "assistant"))
        .map((m) => ({ role: m.role, content: String(m.content || "") }))
    : null;
  if (!messages?.length) {
    return NextResponse.json({ error: "messages 不能为空" }, { status: 400 });
  }

  let inventory = "";
  try {
    inventory = await listNotesText(token, user.id, "");
  } catch (_) {
    inventory = "";
  }

  const { apiKey, base, model } = llmConfig();
  if (apiKey) {
    try {
      const llmMessages = [
        {
          role: "system",
          content: inventory
            ? `${SYSTEM_PROMPT}\n\n当前笔记本摘要：\n${inventory}`
            : SYSTEM_PROMPT,
        },
        ...messages.slice(-24),
      ];
      const data = await callUpstream({
        apiKey,
        base,
        model: body.model || model,
        messages: llmMessages,
        tools: TOOL_SCHEMAS,
      });
      const msg = data?.choices?.[0]?.message || {};
      const call = parseToolCall(msg);
      const content = String(msg.content || "").trim();

      if (!call) {
        return NextResponse.json({
          reply:
            content ||
            "可以说得更具体一点，或让我「记一下…」「列出笔记」。",
          content:
            content ||
            "可以说得更具体一点，或让我「记一下…」「列出笔记」。",
          pending: null,
        });
      }

      if (!WRITE_TOOLS.has(call.name)) {
        let out = "";
        if (call.name === "list_notes") {
          out = await listNotesText(token, user.id, call.args?.kind);
        } else {
          out = `暂不支持只读工具：${call.name}`;
        }
        const reply = content ? `${content}\n\n${out}` : out;
        return NextResponse.json({ reply, content: reply, pending: null });
      }

      const pending = makePending(call.name, call.args);
      const tip = content || "确认要执行吗？";
      const reply = `${tip}\n${pending.summary}`;
      return NextResponse.json({ reply, content: reply, pending });
    } catch (e) {
      console.error("direct llm+tools failed", e);
      // fall through
    }
  }

  // 回退：无 tools 的 Edge Function / 或无 key 时的闲聊
  try {
    if (apiKey) {
      const data = await callUpstream({
        apiKey,
        base,
        model: body.model || model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.slice(-24),
        ],
        tools: undefined,
      }).catch(() => null);
      if (data) {
        const content =
          data?.choices?.[0]?.message?.content ||
          data?.reply ||
          data?.content ||
          "";
        return NextResponse.json({
          reply: content,
          content,
          pending: null,
        });
      }
    }

    const upstream = await fetch(`${supabaseUrl()}/functions/v1/llm-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey(),
      },
      body: JSON.stringify({
        model: body.model || model,
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.slice(-24),
        ],
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
      const msg = data.error || data.message || text || "AI 失败";
      const hint =
        String(msg).includes("not found") || String(msg).includes("Function")
          ? "（请在 EdgeOne 配置 LLM_API_KEY，或部署 Supabase llm-chat）"
          : "";
      return NextResponse.json(
        {
          error: `${typeof msg === "string" ? msg : JSON.stringify(msg)}${hint}`,
        },
        { status: upstream.status },
      );
    }
    const content =
      data?.reply ||
      data?.content ||
      data?.choices?.[0]?.message?.content ||
      "";
    return NextResponse.json({
      ...data,
      reply: content,
      content,
      pending: null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e.message ||
          "AI 上游失败。请在 share-web 环境变量配置 LLM_API_KEY / LLM_BASE_URL",
      },
      { status: 502 },
    );
  }
}
