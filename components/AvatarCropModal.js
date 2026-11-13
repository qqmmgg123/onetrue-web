"use client";

import { useEffect, useRef, useState } from "react";

const EXPORT_SIZE = 512;
const JPEG_QUALITY = 0.85;

/**
 * 简易头像裁剪：缩放 + 拖动，导出 512 正方形 JPEG（对齐 App）。
 */
export default function AvatarCropModal({ file, onCancel, onConfirm }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return;
    let url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // 初始缩放：短边铺满裁剪框
      const box = 280;
      const base = Math.max(box / img.width, box / img.height);
      setScale(base);
      setOffset({ x: 0, y: 0 });
      setReady(true);
      URL.revokeObjectURL(url);
      url = null;
    };
    img.src = url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, W, H);

    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = (W - dw) / 2 + offset.x;
    const dy = (H - dh) / 2 + offset.y;
    ctx.drawImage(img, dx, dy, dw, dh);

    // 暗角遮罩，中间留正方形
    const side = Math.min(W, H) * 0.78;
    const left = (W - side) / 2;
    const top = (H - side) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(left, top, side, side);
    ctx.fill("evenodd");
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, side - 1, side - 1);
  }, [ready, scale, offset]);

  function onPointerDown(e) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  }
  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    setOffset({
      x: d.ox + (e.clientX - d.x),
      y: d.oy + (e.clientY - d.y),
    });
  }
  function onPointerUp(e) {
    dragRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch (_) {}
  }

  async function confirm() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || busy) return;
    setBusy(true);
    try {
      const W = canvas.width;
      const H = canvas.height;
      const side = Math.min(W, H) * 0.78;
      const left = (W - side) / 2;
      const top = (H - side) / 2;
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = (W - dw) / 2 + offset.x;
      const dy = (H - dh) / 2 + offset.y;

      const out = document.createElement("canvas");
      out.width = EXPORT_SIZE;
      out.height = EXPORT_SIZE;
      const octx = out.getContext("2d");
      octx.fillStyle = "#fff";
      octx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
      // 将预览裁剪框映射到原图
      const sx = (left - dx) / scale;
      const sy = (top - dy) / scale;
      const sw = side / scale;
      const sh = side / scale;
      octx.drawImage(img, sx, sy, sw, sh, 0, 0, EXPORT_SIZE, EXPORT_SIZE);

      const blob = await new Promise((resolve) =>
        out.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      );
      if (!blob) throw new Error("导出失败");
      const cropped = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      onConfirm?.(cropped);
    } catch (e) {
      onCancel?.(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="crop-overlay" role="dialog" aria-modal="true">
      <div className="crop-panel">
        <h3 style={{ margin: "0 0 8px" }}>裁剪头像</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          拖动调整位置，滑杆缩放；导出 512×512 JPEG
        </p>
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="crop-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <div className="field" style={{ marginTop: 12 }}>
          <label>缩放</label>
          <input
            type="range"
            min={0.2}
            max={3}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            className="btn"
            disabled={!ready || busy}
            onClick={confirm}
          >
            {busy ? "处理中…" : "使用此头像"}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() => onCancel?.()}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
