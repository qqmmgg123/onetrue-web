"use client";

import { useState } from "react";
import { createNote } from "../lib/api";

export default function NoteEditor({
  onCreated,
  onCancel,
  toast,
  initialScheduleAt = null,
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState(initialScheduleAt ? "schedule" : "note");
  const [listIt, setListIt] = useState(false);
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="panel" style={{ maxWidth: 640 }}>
      <h2>{initialScheduleAt ? "新建日程" : "写笔记"}</h2>
      <p className="hint">
        保存到云端；文章勾选上架后会出现在求索雅集。
        {initialScheduleAt
          ? ` 日程时间：${new Date(initialScheduleAt).toLocaleString()}`
          : ""}
      </p>

      {!initialScheduleAt ? (
        <div className="field">
          <label>类型</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              ["note", "随笔"],
              ["memo", "备忘"],
              ["schedule", "日程"],
              ["article", "文章"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`btn ghost ${kind === id ? "on" : ""}`}
                onClick={() => {
                  setKind(id);
                  if (id === "article") setListIt(true);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="field">
        <label>标题</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === "article" ? "文章标题" : "可选"}
        />
      </div>

      <div className="field">
        <label>正文</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="写点什么…"
          rows={12}
        />
      </div>

      {kind === "article" ? (
        <>
          <div className="field">
            <label>城市（可选）</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="如：上海"
            />
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={listIt}
              onChange={(e) => setListIt(e.target.checked)}
            />
            上架到雅集
          </label>
        </>
      ) : null}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const note = await createNote({
                title,
                body,
                kind,
                city,
                listingStatus:
                  kind === "article" && listIt ? "listed" : "draft",
                scheduleAt: initialScheduleAt || undefined,
              });
              toast?.(
                note?.listingStatus === "listed" ? "已上架雅集" : "已保存",
              );
              onCreated?.(note);
            } catch (e) {
              toast?.(e.message || "保存失败");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "保存中…" : "保存"}
        </button>
        {onCancel ? (
          <button className="btn ghost" type="button" onClick={onCancel}>
            取消
          </button>
        ) : null}
      </div>
    </div>
  );
}
