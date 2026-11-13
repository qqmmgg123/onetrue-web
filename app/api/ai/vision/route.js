import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import { hasServerSupabase } from "../../../../lib/server/env";
import { authGetUser } from "../../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function visionConfig() {
  const zhipuKey = (process.env.ZHIPU_API_KEY || "").trim();
  const visionKey = (process.env.VISION_API_KEY || "").trim();
  const llmKey = (process.env.LLM_API_KEY || "").trim();
  if (zhipuKey) {
    return {
      apiKey: zhipuKey,
      base: (
        process.env.ZHIPU_BASE_URL ||
        "https://open.bigmodel.cn/api/paas/v4"
      )
        .trim()
        .replace(/\/+$/, ""),
      model: (process.env.ZHIPU_VISION_MODEL || "glm-4v-flash").trim(),
      source: "智谱GLM-4V",
    };
  }
  if (visionKey) {
    return {
      apiKey: visionKey,
      base: (process.env.VISION_BASE_URL || "https://api.openai.com/v1")
        .trim()
        .replace(/\/+$/, ""),
      model: (process.env.VISION_MODEL || "gpt-4o-mini").trim(),
      source: "VISION",
    };
  }
  // DeepSeek 兼容：部分账号可用 flash 识图
  if (llmKey && /deepseek/i.test(process.env.LLM_BASE_URL || "")) {
    return {
      apiKey: llmKey,
      base: (process.env.LLM_BASE_URL || "https://api.deepseek.com")
        .trim()
        .replace(/\/+$/, ""),
      model: (process.env.DEEPSEEK_VISION_MODEL || "deepseek-chat").trim(),
      source: "DeepSeek识图",
    };
  }
  return null;
}

async function fileToDataUrl(file) {
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  // 限制约 1.2MB 原始，避免撑爆上游
  if (buf.length > 1.5 * 1024 * 1024) {
    throw Object.assign(new Error("图片过大，请选更小的图"), { status: 400 });
  }
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/**
 * POST multipart: file + optional prompt
 * → OpenAI-compatible chat/completions with image
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

  const cfg = visionConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        error:
          "未配置识图：请设置 ZHIPU_API_KEY，或 VISION_API_KEY + VISION_BASE_URL",
      },
      { status: 503 },
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch (_) {
    return NextResponse.json({ error: "需要 multipart 图片" }, { status: 400 });
  }
  const file = form.get("file") || form.get("image");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "缺少图片" }, { status: 400 });
  }
  const prompt =
    String(form.get("prompt") || form.get("text") || "").trim() ||
    "请理解图中文字或内容，用于改笔记。用简洁中文说明。";

  try {
    const dataUrl = await fileToDataUrl(file);
    const upstream = await fetch(`${cfg.base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 800,
      }),
    });
    const raw = await upstream.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      data = { raw };
    }
    if (!upstream.ok) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            data?.error ||
            data?.msg ||
            `识图失败 (${upstream.status})`,
        },
        { status: upstream.status >= 500 ? 502 : upstream.status },
      );
    }
    const text =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      "";
    return NextResponse.json({
      text: String(text).trim(),
      source: cfg.source,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "识图失败" },
      { status: e.status && e.status < 500 ? e.status : 502 },
    );
  }
}
