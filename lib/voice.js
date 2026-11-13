"use client";

/** Web Speech / 云端 ASR 封装 */

export function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function canUseWebSpeech() {
  return Boolean(getSpeechRecognitionCtor());
}

/**
 * 开麦听写（连续）。
 * - 出字靠浏览器 final results
 * - idleMs 内无任何识别结果 → onIdle 后自动 stop（对齐 App 5s 无说话关麦）
 * @returns {{ stop: () => void }}
 */
export function startWebDictation({
  lang = "zh-CN",
  idleMs = 5000,
  onPartial,
  onFinal,
  onError,
  onEnd,
  onIdle,
} = {}) {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    onError?.(new Error("当前浏览器不支持语音识别"));
    return { stop() {} };
  }
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;

  let stopped = false;
  let heard = false;
  let lastActivity = Date.now();
  let idleTimer = null;

  const clearIdle = () => {
    if (idleTimer) {
      window.clearInterval(idleTimer);
      idleTimer = null;
    }
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearIdle();
    try {
      rec.onend = null;
      rec.stop();
    } catch (_) {}
  };

  rec.onresult = (ev) => {
    lastActivity = Date.now();
    let interim = "";
    let finals = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      const t = r[0]?.transcript || "";
      if (r.isFinal) finals += t;
      else interim += t;
    }
    if (interim || finals) heard = true;
    if (interim) onPartial?.(interim);
    if (finals.trim()) onFinal?.(finals.trim());
  };
  rec.onerror = (e) => {
    if (e.error === "aborted" || e.error === "no-speech") return;
    onError?.(new Error(e.error || "语音识别失败"));
  };
  rec.onend = () => {
    clearIdle();
    if (!stopped) {
      // 浏览器偶发自动结束：若仍在听写则尝试重启
      try {
        if (!stopped) rec.start();
        return;
      } catch (_) {}
    }
    onEnd?.();
  };

  if (idleMs > 0) {
    idleTimer = window.setInterval(() => {
      if (stopped) return;
      const gap = Date.now() - lastActivity;
      if (gap >= idleMs) {
        if (!heard) onIdle?.("未检测到说话，已关闭听写");
        else onIdle?.("已较长时间无新内容，听写已关闭");
        stop();
        onEnd?.();
      }
    }, 400);
  }

  try {
    rec.start();
  } catch (e) {
    clearIdle();
    onError?.(e);
  }
  return { stop };
}

/** 录一段 webm → 云端 ASR（无 Web Speech 时的兜底） */
export async function recordAndTranscribe({
  maxMs = 45000,
  onStatus,
  signal,
} = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("无法访问麦克风");
  }
  onStatus?.("正在听…");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";
  const chunks = [];
  const recorder = new MediaRecorder(
    stream,
    mime ? { mimeType: mime } : undefined,
  );
  recorder.ondataavailable = (e) => {
    if (e.data?.size) chunks.push(e.data);
  };

  const stopped = new Promise((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start(250);

  const timer = window.setTimeout(() => {
    try {
      if (recorder.state === "recording") recorder.stop();
    } catch (_) {}
  }, maxMs);

  if (signal) {
    signal.addEventListener("abort", () => {
      try {
        if (recorder.state === "recording") recorder.stop();
      } catch (_) {}
    });
  }

  await stopped;
  window.clearTimeout(timer);
  stream.getTracks().forEach((t) => t.stop());

  const blob = new Blob(chunks, { type: mime || "audio/webm" });
  if (blob.size < 256) throw new Error("没听到声音");
  onStatus?.("转写中…");
  const fd = new FormData();
  fd.append("file", blob, "audio.webm");
  fd.append("language", "zh");
  const res = await fetch("/api/ai/asr", {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `转写失败 (${res.status})`);
  }
  return String(data.text || "").trim();
}
