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
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const seedRef = useRef({ body, format });
  onChangeRef.current = onChange;

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
      const q = quillRef.current;
      if (!q) return;
      const text = String(plain || "");
      const withNl = text.endsWith("\n") ? text : `${text}\n`;
      q.setContents({ ops: [{ insert: withNl }] }, "user");
      emitChange(q, onChangeRef.current);
    },
    replaceDelta(delta) {
      const q = quillRef.current;
      if (!q) return;
      const ops = Array.isArray(delta) ? delta : delta?.ops || [];
      q.setContents({ ops: ops.length ? ops : [{ insert: "\n" }] }, "user");
      emitChange(q, onChangeRef.current);
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
      } else if (ops.align === "center" || ops.align === "right" || ops.align === "justify") {
        q.formatLine(range.index, range.length, "align", ops.align);
      }
      if (ops.size) {
        q.formatText(range.index, range.length, "size", ops.size);
      }
      emitChange(q, onChangeRef.current);
    },
  }));

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
        readOnly: Boolean(readOnly),
        modules: {
          toolbar: readOnly ? false : TOOLBAR,
        },
      });
      const ops = deltaOpsFromBody(seedRef.current.body, seedRef.current.format);
      q.setContents({ ops }, "silent");
      q.on("text-change", (_delta, _old, source) => {
        if (source !== "user") return;
        emitChange(q, onChangeRef.current);
      });
      quillRef.current = q;
    })();

    return () => {
      cancelled = true;
      quillRef.current = null;
      q = null;
    };
  }, [placeholder, readOnly]);

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
    const ops = deltaOpsFromBody(body, format);
    const cur = JSON.stringify(q.getContents()?.ops || []);
    const next = JSON.stringify(ops);
    if (cur !== next) {
      q.setContents({ ops }, "silent");
    }
  }, [body, format]);

  return (
    <div
      className={`quill-host${readOnly ? " quill-host-ro" : ""}`}
      style={{ ["--quill-min-h"]: `${minHeight}px` }}
    >
      <div ref={editorRef} />
    </div>
  );
});

export default QuillEditorField;
