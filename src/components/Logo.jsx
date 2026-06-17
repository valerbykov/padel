// components/Logo.jsx
// Логотип PadelPack: иконка приложения (меняется по теме: тёмная/светлая версия)
// + вордмарк «PadelPack» (Padel — лайм, Pack — основной цвет текста темы)
// + опциональный слоган из i18n. Знаки лежат в public/logo-mark-{dark,light}.png.
import React from "react";
import { t } from "../lib/i18n";

export default function Logo({ height = 44, showTagline = false, theme = "dark", gap }) {
  const mark = theme === "light" ? "/logo-mark-light.png" : "/logo-mark-dark.png";
  const m = Math.round(height * 1.12);
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: gap ?? Math.round(height * 0.3) }}>
        <img
          src={mark}
          alt="PadelPack"
          width={m}
          height={m}
          style={{ width: m, height: m, borderRadius: Math.round(m * 0.235), flexShrink: 0, display: "block" }}
        />
        <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: height, lineHeight: 1, letterSpacing: "-0.5px", whiteSpace: "nowrap" }}>
          <span style={{ color: "var(--lime)" }}>Padel</span>
          <span style={{ color: "var(--ink)" }}>Pack</span>
        </span>
      </div>
      {showTagline && (
        <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: Math.max(11, Math.round(height * 0.32)), color: "var(--mut)", textAlign: "center" }}>
          {t("tagline")}
        </div>
      )}
    </div>
  );
}
