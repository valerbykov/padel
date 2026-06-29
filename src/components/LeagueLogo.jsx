// components/LeagueLogo.jsx
// Логотип лиги: картинка из бакета league-logos, либо заглушка с первой
// буквой названия (тематические цвета). Используется в переключателе лиг,
// шапке доски и на публичной странице.
import React from "react";

export default function LeagueLogo({ url, name = "", size = 32, radius }) {
  const r = radius ?? Math.round(size * 0.28);
  const initial = (name.trim()[0] || "?").toUpperCase();
  if (url) {
    return (
      <img src={url} alt="" loading="lazy" decoding="async"
        style={{ width: size, height: size, borderRadius: r, objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0, display: "block" }} />
    );
  }
  return (
    <span style={{ width: size, height: size, borderRadius: r, flexShrink: 0, background: "color-mix(in srgb,var(--lime) 16%,transparent)", color: "var(--lime)", border: "1px solid var(--line)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontFamily: "'Outfit',sans-serif", fontSize: Math.round(size * 0.42) }}>
      {initial}
    </span>
  );
}
