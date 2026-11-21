/** 笔记内 AI 工具 schema（立刻改草稿，与 App note_ai_panel 对齐） */

import {
  extractPseudoToolCalls,
  parseToolArgs,
  pickDraftPlain,
} from "../ai-plain";

export const NOTE_AI_SYSTEM = `你是「醍醐」笔记编辑助手。上方是用户正在写的草稿及其选项。
职责：改写/排版正文，以及改当前这篇的形态与选项；不要改其他笔记。
可用工具（立刻改草稿，无需确认）：
- set_title：改标题（写文章/生成内容时若需要标题，必须同一轮再调用 replace_draft 写入完整正文，禁止只改标题）
- replace_draft：用「纯文本」**整篇替换**正文。参数名必须是 plain。写全新文章/大段重写时用。
- append_draft：在现有正文**末尾追加**纯文本（plain 仅为要追加的内容）。
- edit_span：按原文片段做局部增删改。参数：action(replace|delete|insert_after|insert_before)、find(原文中的句子/段落，尽量照抄)、text(新内容；delete 可不传)、all(可选，true=改全部匹配)。用户说「在某句后面加/删掉某句/把某段改成…」时必须用本工具，禁止整篇 replace。
- replace_delta：仅在用户明确要求保留/设置富文本结构且要整篇重写时使用
- apply_format：套格式
- set_note_options：改形态与选项。字段：kind(note|memo|schedule|article|admonition)、schedule_at、remind_at、recur_freq、recur_byday、recur_until、recur_count、remind_offset_min、listed、city
硬性规则：
1) 写全新全文 → replace_draft；文末追加 → append_draft；局部增删改 → edit_span。
2) 局部修改禁止用 replace_draft 只写那一句（会覆盖全文）。
3) edit_span 的 find 必须能在「当前正文」里匹配到；匹配不到就换更短/更贴原文的 find，不要臆造。
4) 用户一句话里有多处「前面写/后面写/删掉/改成」时：同一轮必须按顺序多次调用 edit_span（或合并为更少次仍覆盖全部改动），禁止只做第一处就结束。
5) 同一锚点连续「后面写」多次：优先一次 insert_after，text 按用户顺序拼在一起；若分多次，后一次的 find 用上一处刚插入的文字。
6) 没有成功调用写入类工具之前，禁止说「已写入/已追加/已删除/已完成」。
7) 用户说「把正文贴到对话里」时：写在回复里，禁止改草稿工具。
8) 工具成功后不要复述大段正文；一句话即可。
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
        "用纯文本整篇替换正文。必须传 plain（完整正文）。写全新文章时用；追加内容请用 append_draft。",
      parameters: {
        type: "object",
        properties: {
          plain: {
            type: "string",
            description: "完整正文纯文本，段落之间用换行分隔",
          },
        },
        required: ["plain"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "append_draft",
      description:
        "在现有正文末尾追加纯文本。plain 只含要追加的内容（如一句），不要包含原文。用户要求「最后加一句/追加」时必须用本工具。",
      parameters: {
        type: "object",
        properties: {
          plain: {
            type: "string",
            description: "仅追加的纯文本",
          },
        },
        required: ["plain"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_span",
      description:
        "按原文片段局部编辑：replace 改写、delete 删除、insert_after 在某句后插入、insert_before 在某句前插入。find 须能匹配当前正文。用户要求多处局部修改时，同一轮可多次调用本工具（按顺序）。",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["replace", "delete", "insert_after", "insert_before"],
          },
          find: {
            type: "string",
            description: "原文中的定位片段（句子或段落，尽量照抄）",
          },
          text: {
            type: "string",
            description: "replace/insert 的新内容；delete 时可省略",
          },
          all: {
            type: "boolean",
            description: "true 时修改全部匹配处，默认只改第一处",
          },
        },
        required: ["action", "find"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_delta",
      description: "用 Quill Delta JSON 整篇替换正文（不要用于追加一句）",
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
  const out = [];
  if (Array.isArray(calls) && calls.length) {
    for (const call of calls) {
      const name = call?.function?.name || call?.name;
      if (!name) continue;
      const raw = call?.function?.arguments ?? call?.arguments ?? "{}";
      const { args, raw: rawStr } = parseToolArgs(raw);
      if (name === "replace_draft" || name === "append_draft") {
        const plain = pickDraftPlain(args, rawStr);
        if (plain) args.plain = plain;
      }
      out.push({ name, args });
    }
  }
  // 无正式 tool_calls 时，从 content 抢救伪工具调用
  if (!out.length) {
    const content = String(message?.content || "").trim();
    const { calls: pseudo } = extractPseudoToolCalls(content);
    out.push(...pseudo);
  }
  return out;
}

/** 若 content 是伪工具调用，返回应展示给用户的干净回复 */
export function cleanNoteAiReply(content, toolCalls) {
  const text = String(content || "").trim();
  if (!text) return "";
  if (toolCalls?.length) {
    const { cleaned } = extractPseudoToolCalls(text);
    // 已有工具调用且 content 像工具转储 → 不展示转储
    if (
      /^(replace_draft|append_draft|set_title)\b/i.test(text) ||
      cleaned === ""
    ) {
      return cleaned;
    }
  }
  const { calls, cleaned } = extractPseudoToolCalls(text);
  if (calls.length) return cleaned;
  return text;
}
