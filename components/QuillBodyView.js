"use client";

import { useEffect, useRef } from "react";
import {
  deltaOpsFromBody,
  kStoredQuill,
  plainTextFromBody,
} from "../lib/quill-body";

/** 只读富文本：用 Quill 渲染，与 App 只读 QuillEditor / 存库 Delta 一致 */
export default function QuillBodyView({
  body = "",
  format = kStoredQuill,
  emptyText = "（正文为空）",
  className = "",
}) {
  const hostRef = useRef(null);
  const quillRef = useRef(null);
  const plain = plainTextFromBody(body, format);

  useEffect(() => {
    if (!plain.trim()) return;
    let cancelled = false;

    (async () => {
      const [{ default: Quill }] = await Promise.all([
        import("quill"),
        import("quill/dist/quill.snow.css"),
      ]);
      if (cancelled || !hostRef.current) return;
      if (!quillRef.current) {
        quillRef.current = new Quill(hostRef.current, {
          theme: "snow",
          readOnly: true,
          modules: { toolbar: false },
        });
      }
      const ops = deltaOpsFromBody(body, format);
      quillRef.current.setContents({ ops }, "silent");
    })();

    return () => {
      cancelled = true;
    };
  }, [body, format, plain]);

  if (!plain.trim()) {
    return <p className={`sub ${className}`.trim()}>{emptyText}</p>;
  }

  return (
    <div
      className={`quill-host quill-host-ro quill-body-view ${className}`.trim()}
    >
      <div ref={hostRef} />
    </div>
  );
}
