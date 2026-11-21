"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { deltaOpsFromBody, kStoredQuill } from "../lib/quill-body";

/** 与 App QuillToolbar.basic 子集对齐：字号/标题/粗斜体/列表/对齐 */
const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  [{ size: ["small", false, "large", "huge"] }],
  ["bold", "italic"],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ align: [] }],
  ["clean"],
];

function emitChange(q, onChange) {
  if (!q || !onChange) return;
  const next = q.getContents()?.ops || [];
  const plain = q.getText().replace(/\n+$/, "");
  onChange(next, plain);
}

const QuillEditorField = forwardRef(function QuillEditorField(
  {
    body = "",
    format = kStoredQuill,
    onChange,
    placeholder = "写点什么…",
    readOnly = false,
    minHeight = 180,
  },
  ref,
) {
  const hostRef = useRef(null);
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const seedRef = useRef({ body, format });
  const readOnlyRef = useRef(readOnly);
  /** imperative 写入后跳过下一次 body prop 同步，避免 AI 连续改写被旧 seed 打回 */
  const skipSeedSyncRef = useRef(0);
  onChangeRef.current = onChange;
  readOnlyRef.current = readOnly;

  useImperativeHandle(ref, () => ({
    getPlain() {
      const q = quillRef.current;
      return q ? q.getText().replace(/\n+$/, "") : "";
    },
    getOps() {
      return quillRef.current?.getContents()?.ops || [{ insert: "\n" }];
    },
    insertText(text) {
      const q = quillRef.current;
      const t = String(text || "");
      if (!q || !t) return;
      const range = q.getSelection(true);
      const index =
        range && typeof range.index === "number"
          ? range.index
          : Math.max(0, q.getLength() - 1);
      q.insertText(index, t, "user");
      q.setSelection(index + t.length, 0, "silent");
      emitChange(q, onChangeRef.current);
    },
    replacePlain(plain) {
      const text = String(plain || "");
      const withNl = text.endsWith("\n") ? text : `${text}\n`;
      const ops = [{ insert: withNl }];
      const q = quillRef.current;
      if (q) {
        skipSeedSyncRef.current += 1;
        q.setContents(ops, "user");
        emitChange(q, onChangeRef.current);
      }
      return ops;
    },
    appendPlain(plain) {
      const add = String(plain || "").replace(/\n+$/, "").trim();
      if (!add) return this.getOps?.() || [{ insert: "\n" }];
      const cur = this.getPlain?.() || "";
      const next = cur.trim() ? `${cur.trim()}\n${add}` : add;
      return this.replacePlain(next);
    },
    replaceDelta(delta) {
      const opsIn = Array.isArray(delta) ? delta : delta?.ops || [];
      const ops = opsIn.length ? opsIn : [{ insert: "\n" }];
      const q = quillRef.current;
      if (q) {
        skipSeedSyncRef.current += 1;
        q.setContents(ops, "user");
        emitChange(q, onChangeRef.current);
      }
      return ops;
    },
    applyFormat(ops = {}) {
      const q = quillRef.current;
      if (!q) return;
      let range = q.getSelection(true);
      if (!range || range.length === 0) {
        const len = Math.max(0, q.getLength() - 1);
        if (len > 0) {
          q.setSelection(0, len, "silent");
          range = { index: 0, length: len };
        }
      }
      if (!range || range.length === 0) return;
      if (ops.bold === true) q.formatText(range.index, range.length, "bold", true);
      if (typeof ops.header === "number") {
        q.formatLine(range.index, range.length, "header", ops.header || false);
      } else if (ops.header === null) {
        q.formatLine(range.index, range.length, "header", false);
      }
      if (ops.list === "ordered") {
        q.formatLine(range.index, range.length, "list", "ordered");
      } else if (ops.list === "bullet") {
        q.formatLine(range.index, range.length, "list", "bullet");
      } else if (ops.list === "none") {
        q.formatLine(range.index, range.length, "list", false);
      }
      if (ops.align === "left" || ops.align === "") {
        q.formatLine(range.index, range.length, "align", false);
      } else if (
        ops.align === "center" ||
        ops.align === "right" ||
        ops.align === "justify"
      ) {
        q.formatLine(range.index, range.length, "align", ops.align);
      }
      if (ops.size) {
        q.formatText(range.index, range.length, "size", ops.size);
      }
      emitChange(q, onChangeRef.current);
    },
  }));

  // 只初始化一次；readOnly 切换只用 enable，避免 snow 工具栏重复挂载
  useEffect(() => {
    let cancelled = false;
    let q = null;

    (async () => {
      const [{ default: Quill }] = await Promise.all([
        import("quill"),
        import("quill/dist/quill.snow.css"),
      ]);
      if (cancelled || !editorRef.current || quillRef.current) return;

      q = new Quill(editorRef.current, {
        theme: "snow",
        placeholder,
        readOnly: Boolean(readOnlyRef.current),
        modules: {
          toolbar: TOOLBAR,
        },
      });
      const ops = deltaOpsFromBody(seedRef.current.body, seedRef.current.format);
      q.setContents(ops, "silent");
      q.on("text-change", (_delta, _old, source) => {
        if (source !== "user") return;
        emitChange(q, onChangeRef.current);
      });
      if (readOnlyRef.current) q.enable(false);
      quillRef.current = q;
    })();

    return () => {
      cancelled = true;
      quillRef.current = null;
      q = null;
      // Quill snow 会在容器旁插入 .ql-toolbar；整宿主清空，避免残留双栏
      if (hostRef.current) {
        hostRef.current.innerHTML = "";
        const ed = document.createElement("div");
        editorRef.current = ed;
        hostRef.current.appendChild(ed);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载一次
  }, []);

  useEffect(() => {
    const q = quillRef.current;
    if (!q) return;
    q.enable(!readOnly);
  }, [readOnly]);

  useEffect(() => {
    const q = quillRef.current;
    if (!q) return;
    const prev = seedRef.current;
    if (prev.body === body && prev.format === format) return;
    seedRef.current = { body, format };
    if (skipSeedSyncRef.current > 0) {
      skipSeedSyncRef.current -= 1;
      return;
    }
    const ops = deltaOpsFromBody(body, format);
    const cur = JSON.stringify(q.getContents()?.ops || []);
    const next = JSON.stringify(ops);
    if (cur !== next) {
      q.setContents(ops, "silent");
      emitChange(q, onChangeRef.current);
    }
  }, [body, format]);

  return (
    <div
      ref={hostRef}
      className={`quill-host${readOnly ? " quill-host-ro" : ""}`}
      style={{ ["--quill-min-h"]: `${minHeight}px` }}
    >
      <div ref={editorRef} />
    </div>
  );
});

export default QuillEditorField;
