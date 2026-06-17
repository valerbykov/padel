// components/EmptyState.jsx
// Иллюстрированное пустое состояние в стиле бренда: лаймовая падел-ракетка + мяч,
// под ней — текст. Опциональные children (например, кнопка действия).
import React from "react";

function RacketBall() {
  return (
    <svg width="116" height="116" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <g stroke="var(--lime)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="50" cy="42" rx="30" ry="34" />
        <path d="M38 72 L46 98 M62 72 L54 98" />
        <path d="M46 98 H54" />
      </g>
      <g fill="var(--lime)">
        <circle cx="40" cy="32" r="3.1" /><circle cx="52" cy="28" r="3.1" /><circle cx="64" cy="32" r="3.1" />
        <circle cx="38" cy="44" r="3.1" /><circle cx="50" cy="42" r="3.1" /><circle cx="62" cy="44" r="3.1" />
        <circle cx="44" cy="56" r="3.1" /><circle cx="56" cy="56" r="3.1" />
      </g>
      <circle cx="92" cy="80" r="15" fill="var(--lime)" />
      <path d="M83 70 a15 15 0 0 1 0 20" stroke="#0a1612" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function EmptyState({ text, children, className = "pl-card" }) {
  return (
    <div className={className} style={{ padding: "30px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <RacketBall />
      <div style={{ color: "var(--mut)", fontSize: 14, maxWidth: 290, lineHeight: 1.5 }}>{text}</div>
      {children}
    </div>
  );
}
