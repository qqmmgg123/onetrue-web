/**
 * 与 App Material Icons 对齐的内联 SVG（不依赖外网字体）。
 * 对应：edit_note / sticky_note_2 / calendar_month / menu_book / more_horiz
 */

function NavSvg({ children }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** 笔记 — Icons.edit_note / edit_note_outlined */
export function IconNotes({ filled }) {
  return (
    <NavSvg>
      {filled ? (
        <path
          fill="currentColor"
          d="M3 10h11v2H3v-2zm0-2h11V6H3v2zm0 8h7v-2H3v2zm15.01-3.13.71-.71-2.12-2.12-.71.71v3.04h3.04zM13 21v-2.13l6.56-6.56 2.12 2.12L15.12 21H13z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M14 21v-2.13l6.56-6.56c.22-.22.47-.39.75-.51.28-.12.58-.19.89-.19.31 0 .61.07.89.19.28.12.53.29.75.51l.71.71c.22.22.39.47.51.75.12.28.19.58.19.89s-.07.61-.19.89c-.12.28-.29.53-.51.75L16.13 21H14zm6.56-7.98-.71-.71-2.12 2.12.71.71 2.12-2.12zM3 6v2h11V6H3zm0 4v2h11v-2H3zm0 4v2h7v-2H3z"
        />
      )}
    </NavSvg>
  );
}

/** 备忘 — Icons.sticky_note_2 / sticky_note_2_outlined */
export function IconMemo({ filled }) {
  return (
    <NavSvg>
      {filled ? (
        <path
          fill="currentColor"
          d="M19 3H4.99C3.89 3 3 3.9 3 5l.01 14c0 1.1.89 2 1.99 2h10l6-6V5c0-1.1-.9-2-2-2zM7 8h10v2H7V8zm5 6H7v-2h5v2zm2 5.5V14h5.5L14 19.5z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M19 5v6.17L16.17 14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h10l6-6V5c0-1.1-.9-2-2-2zm-7 11H7v-2h5v2zm5-4H7V8h10v2z"
        />
      )}
    </NavSvg>
  );
}

/** 阅读 — Icons.menu_book / menu_book_outlined */
export function IconBook({ filled }) {
  return (
    <NavSvg>
      {filled ? (
        <path
          fill="currentColor"
          d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zM3 18.5V7c1.1-.35 2.3-.5 3.5-.5 1.34 0 3.05.35 4.5 1v11.5c-1.35-.85-3.8-1.5-5.5-1.5-.96 0-1.89.13-2.75.4-.1.03-.25.05-.35.05-.25 0-.4-.2-.4-.45zm16.15.05c-.1 0-.25-.05-.35-.05-.86-.27-1.79-.4-2.75-.4-1.7 0-4.15.65-5.5 1.5V7.5c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.55c0 .25-.15.45-.4.45z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"
        />
      )}
    </NavSvg>
  );
}

/** @deprecated 保留兼容；主导航已改为笔记 */
export function IconTihu({ filled }) {
  return <IconNotes filled={filled} />;
}

export function IconExplore({ filled }) {
  return <IconBook filled={filled} />;
}

/** 日常 — Icons.calendar_month / calendar_month_outlined */
export function IconCalendar({ filled }) {
  return (
    <NavSvg>
      {filled ? (
        <path
          fill="currentColor"
          d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"
        />
      )}
    </NavSvg>
  );
}

export function IconEdit({ filled }) {
  return (
    <NavSvg>
      <path
        fill="currentColor"
        d={
          filled
            ? "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
            : "M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"
        }
      />
    </NavSvg>
  );
}

/** 其他 — Icons.more_horiz */
export function IconMore() {
  return (
    <NavSvg>
      <path
        fill="currentColor"
        d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
      />
    </NavSvg>
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
