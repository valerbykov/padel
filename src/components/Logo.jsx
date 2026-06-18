// components/Logo.jsx
// Логотип PadelPack — текстовый вордмарк (Padel — лайм, Pack — основной цвет текста темы)
// + опциональный слоган из i18n. Без иконки-чипа: фирменная иконка живёт как иконка
// приложения / сплэш, а внутри интерфейса логотип — чистый текст (масштабируется,
// сам подстраивается под светлую/тёмную тему).
import React from "react";
import { t } from "../lib/i18n";

export default function Logo({ height = 44, showTagline = false }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: height, lineHeight: 1, letterSpacing: "-0.5px", whiteSpace: "nowrap" }}>
        <span style={{ color: "var(--lime)" }}>Padel</span>
        <span style={{ color: "var(--ink)" }}>Pack</span>
      </span>
      {showTagline && (
        <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: Math.max(11, Math.round(height * 0.32)), color: "var(--mut)", textAlign: "center" }}>
          {t("tagline")}
        </div>
      )}
    </div>
  );
}
