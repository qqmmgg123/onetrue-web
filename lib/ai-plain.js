/** 与 App lib/domain/ai_text.dart 对齐：清理模型正文并解析 tool 参数。 */

export function sanitizeAiPlainText(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return s;
  const fence =
    /^```(?:json|markdown|md|text|quill)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i;
  const m = s.match(fence);
  if (m) s = String(m[1] || "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith("[")) {
    try {
      const decoded = JSON.parse(s);
      if (Array.isArray(decoded)) {
        let buf = "";
        for (const op of decoded) {
          if (op && typeof op.insert === "string") buf += op.insert;
        }
        const plain = buf.replace(/\n+$/, "");
        if (plain.trim()) return plain.trim();
      }
    } catch (_) {
      /* ignore */
    }
  }
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/\*\*(.+?)\*\*/g, "$1");
  s = s.replace(/__(.+?)__/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  return s.trim();
}

/** 从 tool args / 破损 JSON 里取出正文。 */
export function pickDraftPlain(args, rawArgs) {
  const obj = args && typeof args === "object" ? args : {};
  for (const k of ["plain", "text", "body", "content", "draft", "article"]) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) {
      return sanitizeAiPlainText(v);
    }
  }
  const raw = typeof rawArgs === "string" ? rawArgs : "";
  if (!raw.trim()) return "";
  for (const k of ["plain", "text", "body", "content"]) {
    const extracted = extractJsonStringField(raw, k);
    if (extracted.trim()) return sanitizeAiPlainText(extracted);
  }
  return "";
}

function extractJsonStringField(raw, key) {
  const token = `"${key}"`;
  const idx = raw.indexOf(token);
  if (idx < 0) return "";
  const colon = raw.indexOf(":", idx + token.length);
  if (colon < 0) return "";
  let i = colon + 1;
  while (i < raw.length && /\s/.test(raw[i])) i += 1;
  if (raw[i] !== '"') return "";
  i += 1;
  let out = "";
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "\\") {
      const n = raw[i + 1];
      if (n == null) break;
      if (n === "n") out += "\n";
      else if (n === "r") out += "\r";
      else if (n === "t") out += "\t";
      else out += n;
      i += 2;
      continue;
    }
    if (ch === '"') break;
    out += ch;
    i += 1;
  }
  return out;
}

/** 宽松解析 function.arguments（兼容未转义换行）。 */
export function parseToolArgs(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { args: raw, raw: "" };
  }
  const s = String(raw ?? "").trim() || "{}";
  try {
    const args = JSON.parse(s);
    if (args && typeof args === "object") return { args, raw: s };
  } catch (_) {
    /* repair */
  }
  try {
    const repaired = s.replace(/("(?:\\.|[^"\\])*")|[\r\n]+/g, (m, str) =>
      str ? str : "\\n",
    );
    const args = JSON.parse(repaired);
    if (args && typeof args === "object") return { args, raw: s };
  } catch (_) {
    /* ignore */
  }
  return { args: {}, raw: s };
}

/** 把「文章/备忘」等中文或别名归一成 kind 码。 */
export function normalizeNoteKind(raw, { allowAdmonition = false } = {}) {
  const original = String(raw ?? "").trim();
  if (!original) return null;
  const k = original.toLowerCase();
  const map = {
    note: "note",
    笔记: "note",
    随笔: "note",
    memo: "memo",
    备忘: "memo",
    schedule: "schedule",
    日常: "schedule",
    日程: "schedule",
    article: "article",
    文章: "article",
    admonition: "admonition",
    谏言: "admonition",
  };
  const hit = map[k] || map[original] || null;
  if (hit === "admonition" && !allowAdmonition) return null;
  return hit;
}

/**
 * 从用户话里推断目标形态：改类型 / 写备忘 / 写文章 / 安排日常。
 */
export function inferKindFromUserText(text) {
  const t = String(text || "");
  if (/改成文章|换成文章|类型改成文章|改成\s*article/i.test(t)) return "article";
  if (/改成备忘|换成备忘|类型改成备忘|改成\s*memo/i.test(t)) return "memo";
  if (/改成日常|换成日常|改成日程|类型改成日常|改成\s*schedule/i.test(t)) {
    return "schedule";
  }
  if (/改成笔记|换成笔记|类型改成笔记|改成\s*note/i.test(t)) return "note";
  if (/改成谏言|换成谏言|类型改成谏言/.test(t)) return "admonition";

  if (/备忘/.test(t) && (/写|记|加|新建|创建/.test(t) || looksLikeWriteRequest(t))) {
    return "memo";
  }
  if (/文章/.test(t) && looksLikeWriteRequest(t)) return "article";
  if (/(日常|日程)/.test(t) && (/写|安排|新建|创建/.test(t) || looksLikeWriteRequest(t))) {
    return "schedule";
  }
  if (/笔记/.test(t) && looksLikeWriteRequest(t) && !/文章|备忘|日常|日程/.test(t)) {
    return "note";
  }
  return null;
}

export function looksLikeWriteRequest(text) {
  const t = String(text || "");
  if (
    /写一篇|写一篇文章|生成一篇|帮我写|扩写|润色|改写|重写|纠正正文|写入正文|写正文|起草|写文|生成正文|写个|写份|写一下|写段|补全文|填充正文/.test(
      t,
    )
  ) {
    return true;
  }
  // 跟进：抱怨正文空、没写内容
  return /正文.?(没有|没写|为空|空的|呢)|没有.?(正文|内容)|没写内容|正文呢|怎么没有正文|内容呢/.test(
    t,
  );
}

/**
 * 估算用户一句话里要求几处局部编辑（连续「前面写/后面写/删掉/把…改成」）。
 * 用于：模型只调了一次 edit_span 时触发补全重试。
 */
export function countLikelySpanEditOps(text) {
  const t = String(text || "");
  if (!t.trim()) return 0;
  const re =
    /在[^，。；;\n]{0,48}?(?:前(?:面|边)|后(?:面|边))(?:写|加|插入|补)|(?:前(?:面|边)|后(?:面|边))(?:写|加|插入)|删掉|删除(?:这|那)?(?:句|段|行)?|去掉(?:这|那)?(?:句|段)|把[^，。；;\n]{1,40}?改成/g;
  const n = (t.match(re) || []).length;
  return n;
}

/** 在文末追加 / 加一句 —— 禁止整篇替换 */
export function looksLikeAppendRequest(text) {
  const t = String(text || "");
  // 「在某句后面写…」是局部 edit_span，不算文末追加
  if (countLikelySpanEditOps(t) >= 1) return false;
  return /最后加|末尾加|文末加|文章最后|在最后|加上一句|加一句|追加|添一句|补一句|再加一句|加到最后|接在后面/.test(
    t,
  );
}

/** 局部增删改（某句后插入 / 删某句 / 改某段） */
export function looksLikeSpanEditRequest(text) {
  const t = String(text || "");
  if (countLikelySpanEditOps(t) >= 1) return true;
  return /后面加|前面加|后面写|前面写|中间加|句后|句前|段后|段前|删掉|删除.*(句|段|这句|那句)|去掉.*(句|段)|把.+改成|改写|替换.*(句|段)|某句|那句|这句|那段|这段/.test(
    t,
  );
}

export function tipIsSpanEdit(tip) {
  return /已删除指定片段|已改写指定片段|已在指定句/.test(String(tip || ""));
}

/**
 * 合并连续、同锚点的 insert_before / insert_after，避免第二步 find 仍指向原文时互相踩踏。
 * insert_after：text 按出现顺序拼接；insert_before：后写的更靠前。
 */
export function coalesceEditSpanCalls(calls) {
  if (!Array.isArray(calls) || calls.length < 2) return calls || [];
  const out = [];
  for (const c of calls) {
    if (!c || c.name !== "edit_span") {
      out.push(c);
      continue;
    }
    const args = { ...(c.args || {}) };
    const action = String(args.action || args.op || "")
      .trim()
      .toLowerCase();
    const find = String(args.find || args.target || args.span || "").trim();
    const text = String(args.text ?? args.with ?? args.plain ?? "");
    const prev = out[out.length - 1];
    const prevAction = String(prev?.args?.action || "")
      .trim()
      .toLowerCase();
    const prevFind = String(prev?.args?.find || "").trim();
    if (
      prev?.name === "edit_span" &&
      find &&
      find === prevFind &&
      action === prevAction &&
      (action === "insert_after" || action === "insert_before")
    ) {
      const prevText = String(prev.args?.text ?? "");
      prev.args = {
        ...prev.args,
        text: action === "insert_after" ? prevText + text : text + prevText,
      };
      continue;
    }
    out.push({ name: "edit_span", args: { ...args, action, find, text } });
  }
  return out;
}

/**
 * 从用户话术解析有序的局部编辑意图（不依赖模型）。
 * 例：在「今天你好吗」前面写「记得…」，再在「今天你好吗」后面写「我们要…」
 */
export function extractSpanEditIntents(text) {
  const t = String(text || "");
  if (!t.trim()) return [];
  const intents = [];
  // 成对引号（开闭必填），避免非贪婪只吃到一个字
  const reQuoted =
    /在\s*[「『“"']([^「『」』“”"']+?)[」』”"']\s*(前|后)(?:面|边)?\s*(?:写|加|插入|补)\s*[，,]?\s*[「『“"']([^「『」』“”"']+?)[」』”"']/g;
  let m;
  while ((m = reQuoted.exec(t)) !== null) {
    const find = String(m[1] || "").trim();
    const side = m[2];
    const insertText = String(m[3] || "").trim();
    if (!find || !insertText) continue;
    intents.push({
      action: side === "前" ? "insert_before" : "insert_after",
      find,
      text: insertText,
    });
  }
  if (intents.length) return intents;

  // 无引号兜底：在锚前面写文 / 在锚后面写文（到逗号或句末）
  const rePlain =
    /在\s*([^\s，,。；;前后来]{1,40}?)\s*(前|后)(?:面|边)?\s*(?:写|加|插入|补)\s*[，,]?\s*([^\s，,。；;]{1,80})/g;
  while ((m = rePlain.exec(t)) !== null) {
    const find = String(m[1] || "").trim();
    const side = m[2];
    const insertText = String(m[3] || "").trim();
    if (!find || !insertText) continue;
    intents.push({
      action: side === "前" ? "insert_before" : "insert_after",
      find,
      text: insertText,
    });
  }
  return intents;
}

/** 合并同锚点连续 insert_before / insert_after 意图。 */
export function coalesceSpanIntents(intents) {
  if (!Array.isArray(intents) || intents.length < 2) return intents || [];
  const out = [];
  for (const raw of intents) {
    const intent = {
      action: String(raw.action || "").trim().toLowerCase(),
      find: String(raw.find || "").trim(),
      text: String(raw.text ?? ""),
      all: raw.all,
    };
    const prev = out[out.length - 1];
    if (
      prev &&
      intent.find &&
      intent.find === prev.find &&
      intent.action === prev.action &&
      (intent.action === "insert_after" || intent.action === "insert_before")
    ) {
      prev.text =
        intent.action === "insert_after"
          ? String(prev.text || "") + intent.text
          : intent.text + String(prev.text || "");
      continue;
    }
    out.push(intent);
  }
  return out;
}

/** 按顺序应用多处 edit_span，返回最终正文与 tips。 */
export function applySpanEditsSequential(sourcePlain, intents) {
  let plain = String(sourcePlain ?? "");
  const tips = [];
  const errors = [];
  const list = coalesceSpanIntents(intents);
  for (const intent of list) {
    const result = applySpanEdit(plain, intent);
    if (!result.ok) {
      errors.push(result.error || "局部编辑失败");
      continue;
    }
    plain = result.next;
    tips.push(result.tip || "已局部编辑");
  }
  return { plain, tips, errors, ok: errors.length === 0 && tips.length > 0 };
}

/** 检查插入类意图的 text 是否都已出现在正文里。 */
export function missingSpanInsertTexts(plain, intents) {
  const src = String(plain || "");
  const missing = [];
  for (const intent of intents || []) {
    if (intent.action !== "insert_before" && intent.action !== "insert_after") {
      continue;
    }
    const text = String(intent.text || "").trim();
    if (text && !src.includes(text)) missing.push(text);
  }
  return missing;
}

/**
 * 在正文中按原文片段做增/删/改。
 * @returns {{ ok: boolean, next?: string, tip?: string, error?: string }}
 */
export function applySpanEdit(sourcePlain, args = {}) {
  const src = String(sourcePlain ?? "");
  const action = String(args.action || args.op || "").trim().toLowerCase();
  const findRaw = String(args.find || args.target || args.span || "").trim();
  const text = String(args.text ?? args.with ?? args.plain ?? "");
  const all = args.all === true || args.all === 1 || args.all === "true";

  if (!["replace", "delete", "insert_after", "insert_before"].includes(action)) {
    return { ok: false, error: "edit_span 需要 action=replace|delete|insert_after|insert_before" };
  }
  if (!findRaw) {
    return { ok: false, error: "edit_span 需要 find（原文片段）" };
  }
  if ((action === "replace" || action === "insert_after" || action === "insert_before") &&
      !String(text).trim()) {
    return { ok: false, error: "edit_span 需要 text（新内容）" };
  }

  const hit = locateSpan(src, findRaw);
  if (!hit) {
    return {
      ok: false,
      error: `未在正文中找到「${findRaw.length > 24 ? `${findRaw.slice(0, 24)}…` : findRaw}」`,
    };
  }

  let next = src;
  if (all) {
    let from = 0;
    let count = 0;
    const pieces = [];
    while (from <= next.length) {
      const sub = next.slice(from);
      const loc = locateSpan(sub, findRaw);
      if (!loc) {
        pieces.push(next.slice(from));
        break;
      }
      const absStart = from + loc.start;
      const absEnd = from + loc.end;
      pieces.push(next.slice(from, absStart));
      pieces.push(spanPatch(next.slice(absStart, absEnd), action, text));
      from = absEnd;
      count += 1;
      if (count > 50) break;
    }
    next = pieces.join("");
  } else {
    const before = src.slice(0, hit.start);
    const mid = src.slice(hit.start, hit.end);
    const after = src.slice(hit.end);
    next = before + spanPatch(mid, action, text) + after;
  }

  const tip =
    action === "delete"
      ? "已删除指定片段"
      : action === "replace"
        ? "已改写指定片段"
        : action === "insert_after"
          ? "已在指定句后插入"
          : "已在指定句前插入";
  return { ok: true, next, tip };
}

function spanPatch(matched, action, text) {
  const t = String(text ?? "");
  if (action === "delete") return "";
  if (action === "replace") return t;
  if (action === "insert_after") return matched + t;
  if (action === "insert_before") return t + matched;
  return matched;
}

/** 优先精确匹配；其次忽略首尾空白；再压缩空白后匹配。 */
function locateSpan(source, findRaw) {
  const src = String(source ?? "");
  const find = String(findRaw ?? "");
  if (!src || !find) return null;

  let idx = src.indexOf(find);
  if (idx >= 0) return { start: idx, end: idx + find.length };

  const trimmed = find.trim();
  if (trimmed && trimmed !== find) {
    idx = src.indexOf(trimmed);
    if (idx >= 0) return { start: idx, end: idx + trimmed.length };
  }

  const normSrc = collapseWs(src);
  const normFind = collapseWs(trimmed || find);
  if (!normFind) return null;
  const nIdx = normSrc.indexOf(normFind);
  if (nIdx < 0) return null;
  // 把压缩空白坐标映回原文（近似：按字符推进）
  return mapCollapsedRange(src, nIdx, nIdx + normFind.length);
}

function collapseWs(s) {
  return String(s).replace(/\s+/g, " ").trim();
}

function mapCollapsedRange(source, cStart, cEnd) {
  let ci = 0;
  let start = -1;
  let end = -1;
  let inWs = false;
  // skip leading ws in collapsed sense
  let i = 0;
  while (i < source.length && /\s/.test(source[i])) i += 1;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      if (!inWs) {
        if (ci === cStart && start < 0) start = i;
        if (ci >= cStart && ci < cEnd) end = i + 1;
        ci += 1;
        inWs = true;
      }
      continue;
    }
    inWs = false;
    if (ci === cStart && start < 0) start = i;
    if (ci < cEnd) end = i + 1;
    ci += 1;
    if (ci >= cEnd && start >= 0) break;
  }
  if (start < 0 || end < 0 || end <= start) return null;
  return { start, end };
}

/**
 * 模型有时不走 tool_calls，把工具名当纯文本输出，例如：
 *   replace_draft
 *   # 标题
 *   正文…
 * 从回复里抢救成工具调用，并清空展示文案。
 */
export function extractPseudoToolCalls(content) {
  const text = String(content || "").trim();
  if (!text) return { calls: [], cleaned: text };

  // ```json { "name": "replace_draft", "arguments": {...} } ```
  const fenceJson = text.match(
    /^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i,
  );
  if (fenceJson) {
    try {
      const obj = JSON.parse(fenceJson[1]);
      const name = obj?.name || obj?.function?.name;
      const args =
        obj?.arguments || obj?.args || obj?.function?.arguments || {};
      if (name === "replace_draft" || name === "append_draft") {
        const plain = pickDraftPlain(args) || sanitizeAiPlainText(args.plain || "");
        if (plain) {
          return { calls: [{ name, args: { plain } }], cleaned: "" };
        }
      }
      if (name === "set_title") {
        return {
          calls: [{ name: "set_title", args: { title: String(args.title || "").trim() } }],
          cleaned: "",
        };
      }
    } catch (_) {
      /* fall through */
    }
  }

  const head = text.match(
    /^(replace_draft|append_draft|set_title)\s*(?:\r?\n+|[:：]\s*)([\s\S]*)$/i,
  );
  if (!head) return { calls: [], cleaned: text };

  const name = head[1].toLowerCase();
  let rest = String(head[2] || "").trim();
  // 去掉可能的 JSON 包装 {"plain":"..."}
  if (rest.startsWith("{")) {
    try {
      const obj = JSON.parse(rest);
      if (name === "set_title") {
        return {
          calls: [
            {
              name: "set_title",
              args: { title: String(obj.title || "").trim() },
            },
          ],
          cleaned: "",
        };
      }
      const plain = pickDraftPlain(obj);
      if (plain) {
        return { calls: [{ name, args: { plain } }], cleaned: "" };
      }
    } catch (_) {
      /* treat as plain */
    }
  }

  if (name === "set_title") {
    const title = rest.split(/\r?\n/)[0].replace(/^#+\s*/, "").trim();
    return {
      calls: title ? [{ name: "set_title", args: { title } }] : [],
      cleaned: "",
    };
  }

  const calls = [];
  const titleLine = rest.match(/^#\s+([^\n]+)\r?\n([\s\S]*)$/);
  if (titleLine) {
    const title = titleLine[1].trim();
    rest = titleLine[2].trim();
    if (title) calls.push({ name: "set_title", args: { title } });
  }
  const plain = sanitizeAiPlainText(rest);
  if (plain) calls.push({ name, args: { plain } });
  return { calls, cleaned: calls.length ? "" : text };
}
