import { randomUUID } from "crypto";
import { restGet, restPatch, restPost } from "./rest";
import { NOTE_SELECT, mapNote, recurFieldsFromBody } from "./note-map";

export const WRITE_TOOLS = new Set([
  "create_note",
  "update_note",
  "convert_note_kind",
  "merge_notes_to_article",
  "publish_note",
  "unpublish_note",
]);

export const SYSTEM_PROMPT = `你是「醍醐」里的全能 AI：可以闲聊、解答问题、帮忙构思与写作；同时能通过 tools 操作用户的笔记本（随笔/备忘/日程/文章）。
用户像微信一样随便聊；不要要求固定格式。没有对应 tool 的事，用自然语言直接答即可。
笔记技能：
1. 只能通过提供的 tools 查询或修改笔记本；不要假装已改数据。
2. create_note / update_note / list_notes；形态互转 convert_note_kind；多篇整理成文 merge_notes_to_article（默认保留原文）；文章上架 publish_note / 下架 unpublish_note。
3. 写文章/整理文章时 body 必须是完整纯文本正文（不要只写标题；不要 Markdown 代码块或 JSON）。
4. 日程重复用 recur_freq/recur_byday/recur_until|recur_count；remind_offset_min 为相对提醒（-1=不提醒）；备忘用 remind_at，禁止设为过去的时间，不提醒则不传。
5. 用户只要把正文「贴到对话里/发给我看」时，用自然语言回复正文，不要为此调用写工具。
6. 写操作提议后等用户确认再执行；回复尽量短。
note_id 使用列表里的 UUID 字符串。`;

export const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "list_notes",
      description: "列出笔记本内容（随笔/备忘/日程/文章）",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            description: "note|memo|schedule|article，空=全部",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description:
        "新建一条笔记。kind: note随笔/memo备忘/schedule日程/article文章。写文章时 title+body 都要有实质内容；body 用纯文本。",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          schedule_at: { type: "string" },
          remind_at: { type: "string" },
          recur_freq: { type: "string" },
          recur_byday: { type: "string" },
          recur_until: { type: "string" },
          recur_count: { type: "integer" },
          remind_offset_min: { type: "integer" },
        },
        required: ["body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_note",
      description: "按 note_id（UUID）或标题关键词改笔记",
      parameters: {
        type: "object",
        properties: {
          note_id: { type: "string" },
          title_query: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          schedule_at: { type: "string" },
          remind_at: { type: "string" },
          recur_freq: { type: "string" },
          recur_byday: { type: "string" },
          recur_until: { type: "string" },
          recur_count: { type: "integer" },
          remind_offset_min: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "convert_note_kind",
      description: "把一篇笔记改成另一种形态，不自动上架",
      parameters: {
        type: "object",
        properties: {
          note_id: { type: "string" },
          title_query: { type: "string" },
          new_kind: { type: "string" },
          schedule_at: { type: "string" },
          remind_at: { type: "string" },
          recur_freq: { type: "string" },
          recur_byday: { type: "string" },
          recur_until: { type: "string" },
          recur_count: { type: "integer" },
          remind_offset_min: { type: "integer" },
        },
        required: ["new_kind"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "merge_notes_to_article",
      description: "把一篇或多篇笔记整理成新文章；默认保留原文",
      parameters: {
        type: "object",
        properties: {
          note_ids: { type: "array", items: { type: "string" } },
          title_queries: { type: "array", items: { type: "string" } },
          title: { type: "string" },
          body: { type: "string" },
          archive_sources: { type: "boolean" },
        },
        required: ["body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "publish_note",
      description: "把文章上架到雅集",
      parameters: {
        type: "object",
        properties: {
          note_id: { type: "string" },
          title_query: { type: "string" },
          city: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unpublish_note",
      description: "下架雅集文章",
      parameters: {
        type: "object",
        properties: {
          note_id: { type: "string" },
          title_query: { type: "string" },
        },
      },
    },
  },
];

function kindLabel(kind) {
  switch (String(kind || "")) {
    case "memo":
      return "备忘";
    case "schedule":
      return "日程";
    case "article":
      return "文章";
    default:
      return "随笔";
  }
}

function snip(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!s) return "（无标题）";
  return s.length > 24 ? `${s.slice(0, 24)}…` : s;
}

export function summarizeTool(tool, args = {}) {
  switch (tool) {
    case "create_note":
      return `记一条${kindLabel(args.kind)}：${snip(args.title || args.body)}`;
    case "update_note":
      return `更新笔记 ${snip(args.title_query || args.note_id)}`;
    case "convert_note_kind":
      return `把笔记改成${kindLabel(args.new_kind)}`;
    case "merge_notes_to_article":
      return `整理成文章「${snip(args.title || "无标题")}」（保留原文）`;
    case "publish_note":
      return "上架文章到雅集";
    case "unpublish_note":
      return "下架雅集文章";
    default:
      return `执行 ${tool}`;
  }
}

export function makePending(tool, args) {
  return {
    id: randomUUID(),
    tool,
    args: args || {},
    summary: summarizeTool(tool, args || {}),
  };
}

function sanitizePlain(raw) {
  return String(raw ?? "")
    .replace(/```[\s\S]*?```/g, (m) =>
      m.replace(/^```\w*\n?/, "").replace(/```$/, ""),
    )
    .replace(/^\s*#+\s*/gm, "")
    .trim();
}

function plainToQuillBody(plain) {
  const text = plain.endsWith("\n") ? plain : `${plain}\n`;
  return JSON.stringify([{ insert: text || "\n" }]);
}

function parseTs(raw, { mustBeFuture = false } = {}) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  if (mustBeFuture && !(d.getTime() > Date.now())) return null;
  return d.toISOString();
}

async function loadNotes(accessToken, userId) {
  const rows = await restGet(
    `/notes?select=${NOTE_SELECT}&owner_id=eq.${userId}&deleted_at=is.null&order=updated_at.desc&limit=80`,
    { accessToken },
  );
  return (rows || []).map(mapNote);
}

export async function listNotesText(accessToken, userId, kind) {
  let notes = await loadNotes(accessToken, userId);
  const k = String(kind || "").trim();
  if (k) notes = notes.filter((n) => n.kind === k);
  if (!notes.length) return "笔记本是空的。";
  const lines = ["笔记列表："];
  for (const n of notes.slice(0, 40)) {
    const title = (n.title || "").trim() || "无标题";
    lines.push(
      `· ${n.id} [${kindLabel(n.kind)}] ${title}${
        n.listingStatus === "listed" ? "（已上架）" : ""
      }`,
    );
  }
  return lines.join("\n");
}

async function resolveNote(accessToken, userId, args) {
  const notes = await loadNotes(accessToken, userId);
  const id = String(args.note_id || "").trim();
  if (id) {
    const hit = notes.find((n) => n.id === id);
    if (hit) return hit;
  }
  const q = String(args.title_query || "").trim();
  if (!q) return null;
  return (
    notes.find(
      (n) =>
        (n.title || "").includes(q) ||
        (n.body || "").includes(q) ||
        String(n.title || "").startsWith(q),
    ) || null
  );
}

function schedulePayloadFromArgs(args, kind) {
  const scheduleAt = parseTs(args.schedule_at);
  const remindOffsetMin =
    args.remind_offset_min == null
      ? undefined
      : Number(args.remind_offset_min);
  const recur = recurFieldsFromBody(
    {
      kind,
      recurFreq: args.recur_freq,
      recurByday: args.recur_byday,
      recurUntil: args.recur_until,
      recurCount: args.recur_count,
      remindOffsetMin:
        remindOffsetMin == null
          ? kind === "schedule"
            ? 0
            : 0
          : remindOffsetMin,
    },
    { kind },
  );
  let remindAt = parseTs(args.remind_at, { mustBeFuture: true });
  if (kind === "schedule" && remindOffsetMin != null) {
    if (remindOffsetMin < 0 || !scheduleAt) remindAt = null;
    else {
      remindAt = new Date(
        new Date(scheduleAt).getTime() - remindOffsetMin * 60000,
      ).toISOString();
      if (!(new Date(remindAt).getTime() > Date.now())) {
        remindAt = null;
        recur.remind_offset_min = -1;
      }
    }
  }
  return { scheduleAt, remindAt, recur };
}

export async function commitTool(accessToken, userId, tool, args = {}) {
  if (!WRITE_TOOLS.has(tool)) return `未知操作：${tool}`;
  const now = new Date().toISOString();

  switch (tool) {
    case "create_note": {
      const kind = String(args.kind || "note").trim() || "note";
      const bodyPlain = sanitizePlain(args.body);
      if (!bodyPlain && !String(args.title || "").trim()) {
        return "标题和正文不能都为空。";
      }
      const { scheduleAt, remindAt, recur } = schedulePayloadFromArgs(
        args,
        kind,
      );
      const id = randomUUID();
      const row = {
        id,
        owner_id: userId,
        kind,
        title:
          String(args.title || "").trim() ||
          (kind === "article"
            ? "无标题文章"
            : kind === "memo"
              ? "备忘"
              : kind === "schedule"
                ? "日程"
                : "随笔"),
        body: plainToQuillBody(bodyPlain || "\n"),
        format: "quill",
        listing_status: "draft",
        city: "",
        updated_at: now,
        created_at: now,
        listed_at: null,
        schedule_at: kind === "schedule" ? scheduleAt : null,
        remind_at:
          kind === "memo" || kind === "schedule" ? remindAt : null,
        ...recur,
        deleted_at: null,
      };
      await restPost("/notes", row, {
        accessToken,
        prefer: "return=minimal",
      });
      return `已记下${kindLabel(kind)} ${id}。`;
    }
    case "update_note": {
      const note = await resolveNote(accessToken, userId, args);
      if (!note) return "找不到要改的笔记。";
      const patch = { updated_at: now };
      if (args.title != null) patch.title = String(args.title).trim();
      if (args.body != null) {
        patch.body = plainToQuillBody(sanitizePlain(args.body));
        patch.format = "quill";
      }
      if (args.schedule_at !== undefined) {
        patch.schedule_at = parseTs(args.schedule_at);
      }
      if (
        args.remind_at !== undefined ||
        args.remind_offset_min !== undefined ||
        args.recur_freq !== undefined
      ) {
        const { scheduleAt, remindAt, recur } = schedulePayloadFromArgs(
          {
            ...args,
            schedule_at:
              args.schedule_at !== undefined
                ? args.schedule_at
                : note.scheduleAt,
          },
          note.kind,
        );
        Object.assign(patch, recur);
        if (args.schedule_at !== undefined) patch.schedule_at = scheduleAt;
        if (
          args.remind_at !== undefined ||
          args.remind_offset_min !== undefined
        ) {
          patch.remind_at = remindAt;
        }
      }
      await restPatch(
        `/notes?id=eq.${encodeURIComponent(note.id)}&owner_id=eq.${userId}`,
        patch,
        { accessToken, prefer: "return=minimal" },
      );
      return `已更新笔记 ${note.id}。`;
    }
    case "convert_note_kind": {
      const note = await resolveNote(accessToken, userId, args);
      if (!note) return "找不到要转换的笔记。";
      const newKind = String(args.new_kind || "").trim();
      if (!newKind) return "请指定 new_kind。";
      const { scheduleAt, remindAt, recur } = schedulePayloadFromArgs(
        {
          ...args,
          schedule_at:
            args.schedule_at !== undefined
              ? args.schedule_at
              : note.scheduleAt,
        },
        newKind,
      );
      const patch = {
        kind: newKind,
        updated_at: now,
        listing_status: "draft",
        listed_at: null,
        ...recur,
      };
      if (args.schedule_at !== undefined) patch.schedule_at = scheduleAt;
      if (
        args.remind_at !== undefined ||
        args.remind_offset_min !== undefined
      ) {
        patch.remind_at = remindAt;
      }
      if (newKind !== "schedule") patch.schedule_at = null;
      if (newKind !== "memo" && newKind !== "schedule") patch.remind_at = null;
      await restPatch(
        `/notes?id=eq.${encodeURIComponent(note.id)}&owner_id=eq.${userId}`,
        patch,
        { accessToken, prefer: "return=minimal" },
      );
      return `已把 ${note.id} 改成${kindLabel(newKind)}。`;
    }
    case "merge_notes_to_article": {
      const notes = await loadNotes(accessToken, userId);
      const ids = new Set();
      for (const e of args.note_ids || []) {
        const s = String(e || "").trim();
        if (s) ids.add(s);
      }
      for (const q of args.title_queries || []) {
        const s = String(q || "").trim();
        if (!s) continue;
        for (const n of notes) {
          if ((n.title || "").includes(s) || (n.body || "").includes(s)) {
            ids.add(n.id);
          }
        }
      }
      const sources = notes.filter((n) => ids.has(n.id));
      const bodyPlain = sanitizePlain(args.body);
      if (!bodyPlain) return "整理后的正文不能为空。";
      const id = randomUUID();
      await restPost(
        "/notes",
        {
          id,
          owner_id: userId,
          kind: "article",
          title: String(args.title || "").trim() || "无标题文章",
          body: plainToQuillBody(bodyPlain),
          format: "quill",
          listing_status: "draft",
          city: "",
          updated_at: now,
          created_at: now,
          listed_at: null,
          schedule_at: null,
          remind_at: null,
          recur_freq: "",
          recur_interval: 1,
          recur_byday: null,
          recur_until: null,
          recur_count: null,
          remind_offset_min: 0,
          deleted_at: null,
        },
        { accessToken, prefer: "return=minimal" },
      );
      if (args.archive_sources === true) {
        for (const s of sources) {
          await restPatch(
            `/notes?id=eq.${encodeURIComponent(s.id)}&owner_id=eq.${userId}`,
            { deleted_at: now, updated_at: now },
            { accessToken, prefer: "return=minimal" },
          );
        }
      }
      return `已生成文章 ${id}${
        sources.length ? `（来源 ${sources.length} 篇，默认保留）` : ""
      }。`;
    }
    case "publish_note": {
      const note = await resolveNote(accessToken, userId, args);
      if (!note) return "找不到文章。";
      const patch = {
        kind: "article",
        listing_status: "listed",
        listed_at: note.listedAt || now,
        updated_at: now,
      };
      if (args.city != null) patch.city = String(args.city).trim();
      await restPatch(
        `/notes?id=eq.${encodeURIComponent(note.id)}&owner_id=eq.${userId}`,
        patch,
        { accessToken, prefer: "return=minimal" },
      );
      try {
        await restPost(
          "/note_stats?on_conflict=note_id",
          {
            note_id: note.id,
            view_count: 0,
            recommend_count: 0,
            comment_count: 0,
          },
          {
            accessToken,
            prefer: "resolution=merge-duplicates,return=minimal",
          },
        );
      } catch (_) {}
      return `已上架文章 ${note.id}。`;
    }
    case "unpublish_note": {
      const note = await resolveNote(accessToken, userId, args);
      if (!note) return "找不到文章。";
      await restPatch(
        `/notes?id=eq.${encodeURIComponent(note.id)}&owner_id=eq.${userId}`,
        {
          listing_status: "draft",
          listed_at: null,
          updated_at: now,
        },
        { accessToken, prefer: "return=minimal" },
      );
      return `已下架文章 ${note.id}。`;
    }
    default:
      return `未知操作：${tool}`;
  }
}

export function parseToolCall(message) {
  const calls = message?.tool_calls;
  if (!Array.isArray(calls) || !calls.length) return null;
  const call = calls[0];
  const name = call?.function?.name || call?.name;
  if (!name) return null;
  let args = {};
  const raw = call?.function?.arguments ?? call?.arguments ?? "{}";
  try {
    args = typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {};
  } catch (_) {
    args = {};
  }
  return { name, args };
}
