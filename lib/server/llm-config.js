/**
 * Web 对话上游：与 App auto 一致 —— 智谱 → 百度千帆 → DeepSeek(LLM_API_KEY)
 * DeepSeek 仅作兜底；未单独选 DeepSeek 时 App 也不会优先走它。
 */

function trimSlash(u) {
  return String(u || "")
    .trim()
    .replace(/\/+$/, "");
}

/** @returns {{ name: string, apiKey: string, base: string, model: string }[]} */
export function resolveLlmEndpoints() {
  const out = [];

  const zhipuKey = (process.env.ZHIPU_API_KEY || "").trim();
  if (zhipuKey) {
    out.push({
      name: "zhipu",
      apiKey: zhipuKey,
      base: trimSlash(
        process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
      ),
      model: (process.env.ZHIPU_CHAT_MODEL || "glm-4-flash").trim(),
    });
  }

  const baiduKey = (process.env.BAIDU_LLM_API_KEY || "").trim();
  if (baiduKey) {
    out.push({
      name: "baidu",
      apiKey: baiduKey,
      base: trimSlash(
        process.env.BAIDU_LLM_BASE_URL || "https://qianfan.baidubce.com/v2",
      ),
      model: (process.env.BAIDU_LLM_MODEL || "ernie-speed-8k").trim(),
    });
  }

  const llmKey = (process.env.LLM_API_KEY || "").trim();
  if (llmKey) {
    out.push({
      name: "deepseek",
      apiKey: llmKey,
      base: trimSlash(
        process.env.LLM_BASE_URL || "https://api.deepseek.com/v1",
      ),
      model: (process.env.LLM_MODEL || "deepseek-chat").trim(),
    });
  }

  return out;
}

export async function callChatCompletions({
  apiKey,
  base,
  model,
  messages,
  tools,
  temperature = 0.3,
}) {
  const chatBody = {
    model,
    temperature,
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

/** 按优先级依次尝试；全部失败抛最后一次错误 */
export async function callChatWithFailover({
  messages,
  tools,
  modelOverride,
  temperature = 0.3,
}) {
  const endpoints = resolveLlmEndpoints();
  if (!endpoints.length) {
    const err = new Error(
      "未配置对话模型。请在 EdgeOne 配置 ZHIPU_API_KEY（推荐），或 BAIDU_LLM_API_KEY / LLM_API_KEY",
    );
    err.status = 503;
    throw err;
  }
  const errors = [];
  for (const ep of endpoints) {
    try {
      const data = await callChatCompletions({
        apiKey: ep.apiKey,
        base: ep.base,
        model: modelOverride || ep.model,
        messages,
        tools,
        temperature,
      });
      return { data, endpoint: ep };
    } catch (e) {
      errors.push(`${ep.name}: ${e.message || e}`);
      console.error(`llm ${ep.name} failed`, e.message || e);
    }
  }
  const err = new Error(`对话模型均不可用：${errors.join("；")}`);
  err.status = 502;
  throw err;
}
