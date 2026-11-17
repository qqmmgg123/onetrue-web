/** 与 App Material 图标语义对齐的线框图标 */

export function IconNotes({ filled }) {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 4h12l4 4v12H4z" fill={filled ? "currentColor" : "none"} />
      <path d="M16 4v4h4" />
      <path d="M8 12h8M8 16h6" stroke={filled ? "#fff" : "currentColor"} />
    </svg>
  );
}

export function IconMemo({ filled }) {
  return (
    <svg viewBox="0 0 24 24">
      <rect
        x="5"
        y="3"
        width="14"
        height="18"
        rx="1"
        fill={filled ? "currentColor" : "none"}
      />
      <path d="M8 8h8M8 12h8M8 16h5" stroke={filled ? "#fff" : "currentColor"} />
    </svg>
  );
}

export function IconBook({ filled }) {
  return (
    <svg viewBox="0 0 24 24">
      <path
        d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 0-2 2V5z"
        fill={filled ? "currentColor" : "none"}
      />
      <path d="M6 3v16" />
    </svg>
  );
}

/** @deprecated 保留兼容；主导航已改为笔记 */
export function IconTihu({ filled }) {
  return <IconNotes filled={filled} />;
}

export function IconExplore({ filled }) {
  return <IconBook filled={filled} />;
}

export function IconCalendar({ filled }) {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="16" rx="1" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
      {filled ? <path d="M7 14h4v4H7z" fill="currentColor" stroke="none" /> : null}
    </svg>
  );
}

export function IconEdit({ filled }) {
  return (
    <svg viewBox="0 0 24 24">
      <path
        d="M4 20h4l10-10-4-4L4 16v4z"
        fill={filled ? "currentColor" : "none"}
      />
      <path d="m13 7 4 4" />
    </svg>
  );
}

export function IconMore() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <circle cx="11" cy="11" r="6" stroke="currentColor" fill="none" strokeWidth="1.7" />
      <path
        d="m16 16 4 4"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconHeart({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path
        d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 4.6-7 9-7 9z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconStar({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path
        d="m12 3 2.4 5.4 5.9.6-4.5 3.9 1.4 5.7L12 15.8 6.8 18.6l1.4-5.7L3.7 9l5.9-.6L12 3z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconAi() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}

export function IconEye({ off = false }) {
  if (off) {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path
          d="M3 3l18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M9.9 5.1A10.5 10.5 0 0 1 12 5c5 0 9.3 3.1 11 7-0.5 1.2-1.3 2.4-2.3 3.4M6.1 6.1C4.2 7.4 2.7 9.1 2 12c1.7 3.9 6 7 10 7 1.4 0 2.8-.3 4-.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}
