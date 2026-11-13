"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  canUseWebSpeech,
  recordAndTranscribe,
  startWebDictation,
} from "../lib/voice";

/**
 * 点按切换听写（对齐 App NoteMicButton）：
 * - 再点关闭
 * - 长时间无说话自动关
 * - 父组件可 stopIfActive（键盘输入时调用）
 *
 * variant=circle：圆形麦克风图标（编辑框右下 / 笔记 AI）
 * variant=text：文字按钮（兼容旧调用）
 */
const VoiceMicButton = forwardRef(function VoiceMicButton(
  {
    onText,
    toast,
    disabled = false,
    className = "",
    variant = "circle",
    idleMs = 5000,
  },
  ref,
) {
  const [active, setActive] = useState(false);
  const [hint, setHint] = useState("");
  const dictRef = useRef(null);
  const abortRef = useRef(null);
  const activeRef = useRef(false);

  function setActiveBoth(v) {
    activeRef.current = v;
    setActive(v);
  }

  function hardStop() {
    dictRef.current?.stop?.();
    dictRef.current = null;
    abortRef.current?.abort?.();
    abortRef.current = null;
    setActiveBoth(false);
    setHint("");
  }

  useImperativeHandle(ref, () => ({
    stopIfActive() {
      if (activeRef.current) hardStop();
    },
    get isActive() {
      return activeRef.current;
    },
  }));

  useEffect(() => {
    return () => hardStop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleDictation() {
    if (disabled) return;
    if (activeRef.current) {
      hardStop();
      return;
    }

    if (!canUseWebSpeech()) {
      setActiveBoth(true);
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
        hardStop();
      }
      return;
    }

    setActiveBoth(true);
    setHint("听写中 · 再点结束");
    dictRef.current = startWebDictation({
      idleMs,
      onFinal: (t) => onText?.(t),
      onError: (e) => toast?.(e.message || "语音失败"),
      onIdle: (msg) => toast?.(msg),
      onEnd: () => {
        dictRef.current = null;
        setActiveBoth(false);
        setHint("");
      },
    });
  }

  if (variant === "text") {
    return (
      <button
        type="button"
        className={`btn ghost voice-mic ${active ? "on" : ""} ${className}`.trim()}
        disabled={disabled}
        title={hint || (active ? "关闭听写" : "听写")}
        onClick={toggleDictation}
      >
        {active ? "关麦" : "听写"}
      </button>
    );
  }

  return (
    <div className={`voice-mic-wrap ${className}`.trim()}>
      {active && hint ? <div className="voice-mic-hint">{hint}</div> : null}
      <button
        type="button"
        className={`voice-mic-circle${active ? " on" : ""}`}
        disabled={disabled}
        aria-label={active ? "关闭听写" : "开始听写"}
        title={hint || (active ? "再点结束" : "听写")}
        onClick={toggleDictation}
      >
        <MicIcon active={active} />
      </button>
    </div>
  );
});

function MicIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      {active ? (
        <>
          <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
          <path
            d="M5 11a7 7 0 0 0 14 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M12 18v3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <rect
            x="9"
            y="3"
            width="6"
            height="11"
            rx="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M5 11a7 7 0 0 0 14 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M12 18v3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

export default VoiceMicButton;
