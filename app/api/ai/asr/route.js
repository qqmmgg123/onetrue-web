import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import { hasServerSupabase } from "../../../../lib/server/env";
import { authGetUser } from "../../../../lib/server/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function asrConfig() {
  const apiKey = (
    process.env.ASR_API_KEY ||
    process.env.LLM_API_KEY ||
    ""
  ).trim();
  const base = (
    process.env.ASR_BASE_URL ||
    process.env.LLM_BASE_URL ||
    "https://api.openai.com/v1"
  )
    .trim()
    .replace(/\/+$/, "");
  const model = (process.env.ASR_MODEL || "whisper-1").trim();
  return { apiKey, base, model };
}

/**
 * 云端 ASR（OpenAI-compatible /audio/transcriptions）。
 * 浏览器无 Web Speech 或用户选择云端时使用。
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

  const { apiKey, base, model } = asrConfig();
  if (!apiKey) {
    return NextResponse.json(
      { error: "未配置 ASR_API_KEY（或 LLM_API_KEY）" },
      { status: 503 },
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch (_) {
    return NextResponse.json({ error: "需要 multipart 音频" }, { status: 400 });
  }
  const file = form.get("file") || form.get("audio");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "缺少音频文件" }, { status: 400 });
  }

  try {
    const fd = new FormData();
    fd.append("file", file, file.name || "audio.webm");
    fd.append("model", model);
    fd.append("language", String(form.get("language") || "zh"));
    const upstream = await fetch(`${base}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
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
            "转写失败",
        },
        { status: upstream.status },
      );
    }
    const transcript = String(data.text || data.result || "").trim();
    return NextResponse.json({ text: transcript, source: "cloud" });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "ASR 失败" },
      { status: 502 },
    );
  }
}
