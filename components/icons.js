export function IconExplore() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function IconHome() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  );
}

export function IconFollow() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" />
      <path d="M4 20a6 6 0 0 1 12 0" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  );
}

export function IconAi() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="5" />
      <path d="m8.5 8.5 1.2 1.2M14.3 14.3l1.2 1.2M15.5 8.5l-1.2 1.2M9.7 14.3l-1.2 1.2" />
    </svg>
  );
}

export function IconMe() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5 19.5a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <circle cx="11" cy="11" r="6" stroke="currentColor" fill="none" strokeWidth="1.7" />
      <path d="m16 16 4 4" stroke="currentColor" fill="none" strokeWidth="1.7" strokeLinecap="round" />
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
