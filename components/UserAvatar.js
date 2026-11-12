"use client";

export default function UserAvatar({ profile, name, size = "", className = "" }) {
  const label =
    (profile?.displayName || profile?.nickname || name || "?").trim() || "?";
  const src = profile?.avatarUrl || "";
  const initial = label.slice(0, 1).toUpperCase();
  return (
    <span className={`avatar ${size} ${className}`.trim()} title={label}>
      {src ? <img src={src} alt="" /> : initial}
    </span>
  );
}
