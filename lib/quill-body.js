/** 与 App note_quill.dart 对齐：库内 body 为 Quill Delta ops JSON，或旧纯文本。 */
export const kStoredQuill = "quill";
export const kStoredPlain = "plain";

/** body + format → Delta ops 数组（可交给 Quill.setContents） */
export function deltaOpsFromBody(body, format = kStoredQuill) {
  const raw = String(body ?? "");
  const trimmed = raw.trim();
  if (!trimmed) return [{ insert: "\n" }];
  const asQuill =
    format === kStoredQuill ||
    format === "quill" ||
    trimmed.startsWith("[");
  if (asQuill) {
    try {
      const decoded = JSON.parse(trimmed);
      if (Array.isArray(decoded) && decoded.length) {
        const last = decoded[decoded.length - 1];
        if (
          last &&
          typeof last.insert === "string" &&
          !last.insert.endsWith("\n")
        ) {
          return [...decoded, { insert: "\n" }];
        }
        return decoded;
      }
    } catch (_) {
      /* fall through */
    }
  }
  const text = raw.endsWith("\n") ? raw : `${raw}\n`;
  return [{ insert: text }];
}

/** Quill Delta / ops → 存库字符串（与 Flutter jsonEncode(delta.toJson()) 一致） */
export function bodyToStorage(deltaOrOps) {
  const ops = normalizeOps(deltaOrOps);
  return JSON.stringify(ops);
}

function normalizeOps(deltaOrOps) {
  if (!deltaOrOps) return [{ insert: "\n" }];
  if (Array.isArray(deltaOrOps)) return deltaOrOps;
  if (Array.isArray(deltaOrOps.ops)) return deltaOrOps.ops;
  return [{ insert: "\n" }];
}

/** Quill Delta / ops / 存库 body → 纯文本 */
export function plainTextFromBody(bodyOrOps, format = kStoredQuill) {
  let ops;
  if (
    Array.isArray(bodyOrOps) ||
    (bodyOrOps && Array.isArray(bodyOrOps.ops))
  ) {
    ops = normalizeOps(bodyOrOps);
  } else {
    ops = deltaOpsFromBody(bodyOrOps, format);
  }
  let buf = "";
  for (const op of ops) {
    if (typeof op?.insert === "string") buf += op.insert;
    else if (op?.insert && typeof op.insert === "object") buf += "\uFFFC";
  }
  return buf.replace(/\u00A0/g, " ").replace(/\n+$/, "").trimEnd();
}

export function isBodyEmpty(bodyOrOps, format = kStoredQuill) {
  return !plainTextFromBody(bodyOrOps, format).trim();
}
