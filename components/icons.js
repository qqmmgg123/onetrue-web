/** 与 App Material 图标语义对齐的线框图标 */

export function IconTihu({ filled }) {
  return (
    <svg viewBox="0 0 24 24">
      {filled ? (
        <path
          d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
          fill="currentColor"
          stroke="none"
        />
      ) : (
        <>
          <path d="M18 16V11a6 6 0 0 0-12 0v5" />
          <path d="M5 18h14" />
          <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2z" />
          <path d="M12 3v1" />
        </>
      )}
    </svg>
  );
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

export function IconExplore({ filled }) {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path
        d="m14.5 9.5-1.2 3.8-3.8 1.2 1.2-3.8 3.8-1.2z"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

export function IconEdit({ filled }) {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 20h4l10-10-4-4L4 16v4z" fill={filled ? "currentColor" : "none"} />
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
