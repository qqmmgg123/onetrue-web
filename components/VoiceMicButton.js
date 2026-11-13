"use client";

import { useEffect, useRef, useState } from "react";
import {
  canUseWebSpeech,
  recordAndTranscribe,
  startWebDictation,
} from "../lib/voice";

/**
 * mode=dictation：点按开关麦（写入 onText，对齐笔记听写）
 * mode=push：按住说话（优先 Web Speech 一次结果；失败再云端 ASR）
 */
export default function VoiceMicButton({
  mode = "dictation",
  onText,
  toast,
  disabled = false,
  className = "",
  title,
}) {
  const [active, setActive] = useState(false);
  const [hint, setHint] = useState("");
  const dictRef = useRef(null);
  const abortRef = useRef(null);
  const holdingRef = useRef(false);

  useEffect(() => {
    return () => {
      dictRef.current?.stop?.();
      abortRef.current?.abort?.();
    };
  }, []);

  async function toggleDictation() {
    if (disabled) return;
    if (active) {
      dictRef.current?.stop?.();
      dictRef.current = null;
      setActive(false);
      setHint("");
      return;
    }
    if (!canUseWebSpeech()) {
      // 无 Web Speech：录一段再云端
      setActive(true);
      setHint("正在听…");
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const text = await recordAndTranscribe({
          onStatus: setHint,
          signal: ac.signal,
        });
        if (text) onText?.(text);
        else toast?.("没听清，请再说一次");
      } catch (e) {
        if (e.name !== "AbortError") toast?.(e.message || "语音失败");
      } finally {
        setActive(false);
        setHint("");
        abortRef.current = null;
      }
      return;
    }
    setActive(true);
    setHint("正在听…说完稍停会出字");
    dictRef.current = startWebDictation({
      onFinal: (t) => onText?.(t),
      onError: (e) => toast?.(e.message || "语音失败"),
      onEnd: () => {
        setActive(false);
        setHint("");
        dictRef.current = null;
      },
    });
  }

  async function pushStart(e) {
    if (disabled || mode !== "push") return;
    e.preventDefault();
    holdingRef.current = true;
    setActive(true);
    setHint("松手发送");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      if (canUseWebSpeech()) {
        // 按住期间连续听，松手 stop 时取最后一段已在 onFinal 写入
        dictRef.current = startWebDictation({
          onFinal: (t) => {
            if (holdingRef.current) onText?.(t);
          },
          onError: (err) => {
            if (holdingRef.current) toast?.(err.message || "语音失败");
          },
        });
      } else {
        const text = await recordAndTranscribe({
          onStatus: setHint,
          signal: ac.signal,
        });
        if (holdingRef.current && text) onText?.(text);
      }
    } catch (err) {
      if (holdingRef.current && err.name !== "AbortError") {
        toast?.(err.message || "语音失败");
      }
    }
  }

  function pushEnd(e) {
    if (mode !== "push") return;
    e.preventDefault();
    holdingRef.current = false;
    dictRef.current?.stop?.();
    dictRef.current = null;
    abortRef.current?.abort?.();
    abortRef.current = null;
    setActive(false);
    setHint("");
  }

  const label =
    title ||
    (mode === "push"
      ? active
        ? "松手"
        : "按住说话"
      : active
        ? "关麦"
        : "听写");

  if (mode === "push") {
    return (
      <button
        type="button"
        className={`btn ghost voice-mic ${active ? "on" : ""} ${className}`.trim()}
        disabled={disabled}
        title={hint || label}
        onPointerDown={pushStart}
        onPointerUp={pushEnd}
        onPointerCancel={pushEnd}
        onPointerLeave={(e) => {
          if (holdingRef.current) pushEnd(e);
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`btn ghost voice-mic ${active ? "on" : ""} ${className}`.trim()}
      disabled={disabled}
      title={hint || label}
      onClick={toggleDictation}
    >
      {active ? "关麦" : "听写"}
      {hint ? <span className="voice-hint">{hint}</span> : null}
    </button>
  );
}
