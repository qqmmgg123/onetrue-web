/** 笔记内 AI 工具 schema（立刻改草稿，与 App note_ai_panel 对齐） */

export const NOTE_AI_SYSTEM = `你是「醍醐」笔记编辑助手。上方是用户正在写的草稿及其选项。
职责：改写/排版正文，以及改当前这篇的形态与选项；不要改其他笔记。
可用工具（立刻改草稿，无需确认）：
- set_title：改标题（写文章/生成内容时若需要标题，必须同时用 replace_draft 写入完整正文，禁止只改标题）
- replace_draft：用「纯文本」替换整篇正文（不要 Markdown、不要代码块、不要 JSON；段落用换行）
- replace_delta：仅在用户明确要求保留/设置富文本结构时使用
- apply_format：套格式
- set_note_options：改形态与选项。字段：kind(note|memo|schedule|article)、schedule_at、remind_at(备忘绝对提醒；空串=不提醒；禁止设为当前时间之前)、recur_freq(once|daily|weekly|monthly|yearly)、recur_byday(如MO)、recur_until(结束日，与count互斥)、recur_count(次数)、remind_offset_min(日程提前分钟，0=开始时，-1=不提醒)、listed(文章上架)、city
重复结束：永不=不传until/count或都空；结束日用recur_until；次数用recur_count。
重要：
1) 用户说「写一篇/生成/扩写/润色/纠正正文」等时，必须调用 replace_draft（或 replace_delta）写入正文；不能只 set_title。
2) 用户说「把正文贴到对话里/发给我看看/读给我」时：把正文写在回复里，禁止调用 replace_draft/replace_delta。
3) 工具成功后不要在回复里复述大段正文；一句话即可（如「已写入正文」）。
回复尽量短。`;

export const NOTE_AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "set_title",
      description: "设置笔记标题",
      parameters: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_draft",
      description:
        "用纯文本替换整篇正文。plain 不得含 Markdown/代码块/JSON；写文章或纠正正文时必须调用本工具。",
      parameters: {
        type: "object",
        properties: { plain: { type: "string" } },
        required: ["plain"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_delta",
      description: "用 Quill Delta JSON 替换整篇正文",
      parameters: {
        type: "object",
        properties: {
          delta: { type: "array", items: { type: "object" } },
        },
        required: ["delta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_format",
      description: "对选区或整篇应用富文本格式",
      parameters: {
        type: "object",
        properties: {
          bold: { type: "boolean" },
          header: { type: "integer" },
          list: {
            type: "string",
            enum: ["ordered", "bullet", "none"],
          },
          align: {
            type: "string",
            enum: ["left", "center", "right"],
          },
          size: {
            type: "string",
            enum: ["small", "large", "huge"],
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_note_options",
      description: "改当前草稿形态与日程/备忘/文章选项",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string" },
          title: { type: "string" },
          schedule_at: { type: "string" },
          remind_at: { type: "string" },
          recur_freq: { type: "string" },
          recur_byday: { type: "string" },
          recur_until: { type: "string" },
          recur_count: { type: "integer" },
          remind_offset_min: { type: "integer" },
          listed: { type: "boolean" },
          city: { type: "string" },
        },
      },
    },
  },
];

export function parseNoteToolCalls(message) {
  const calls = message?.tool_calls;
  if (!Array.isArray(calls) || !calls.length) return [];
  const out = [];
  for (const call of calls) {
    const name = call?.function?.name || call?.name;
    if (!name) continue;
    let args = {};
    const raw = call?.function?.arguments ?? call?.arguments ?? "{}";
    try {
      args = typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {};
    } catch (_) {
      args = {};
    }
    out.push({ name, args });
  }
  return out;
}
