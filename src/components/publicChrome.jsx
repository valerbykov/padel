// components/publicChrome.jsx
// Общая «обвязка» для публичных страниц-приглашений (/l, /j, /t, /r):
// — переключение темы (тёмная/светлая) и языка (RU/EN/ES);
// — CSS-переменные темы применяются инлайном на корень страницы (перекрывают
//   значения из локального <style>, поэтому отдельный light-CSS не нужен).
import React, { useState } from "react";
import { setLang, currentLang, LANGS, LANG_LABELS } from "../lib/i18n";

export const PUBLIC_VARS = {
  dark:  { "--bg": "#0a1612", "--surface": "#11211b", "--surface2": "#16291f", "--line": "#22382c", "--ink": "#eef3ee", "--mut": "#7d9488", "--lime": "#c8ff2d", "--coral": "#ff6a52", "--lime-fg": "#0a1612", colorScheme: "dark" },
  light: { "--bg": "#f2f7f4", "--surface": "#ffffff", "--surface2": "#e6f0ea", "--line": "#c4d9cc", "--ink": "#0d1f18", "--mut": "#4a7060", "--lime": "#2a7a00", "--coral": "#d93a1f", "--lime-fg": "#ffffff", colorScheme: "light" },
};

export function usePublicChrome() {
  const [theme, setTheme] = useState(() => localStorage.getItem("plTheme") || "dark");
  const [lang, setLangState] = useState(() => currentLang);
  const toggleTheme = () => { const n = theme === "dark" ? "light" : "dark"; setTheme(n); localStorage.setItem("plTheme", n); };
  const cycleLang = () => { const i = LANGS.indexOf(lang); const n = LANGS[(i + 1) % LANGS.length]; setLang(n); setLangState(n); };
  return { theme, lang, vars: PUBLIC_VARS[theme] || PUBLIC_VARS.dark, toggleTheme, cycleLang };
}

// Плюрализация для публичных страниц (RU — 3 формы, EN/ES — 2).
const PL = {
  players: { ru: ["игрок", "игрока", "игроков"], en: ["player", "players"], es: ["jugador", "jugadores"] },
  games:   { ru: ["игра", "игры", "игр"],        en: ["game", "games"],     es: ["partida", "partidas"] },
  wins:    { ru: ["победа", "победы", "побед"],   en: ["win", "wins"],       es: ["victoria", "victorias"] },
};
export function plural(n, kind) {
  const f = (PL[kind] && PL[kind][currentLang]) || PL[kind].en;
  if (currentLang === "ru") {
    const m = Math.abs(n) % 100, m1 = m % 10;
    if (m > 10 && m < 20) return f[2];
    if (m1 > 1 && m1 < 5) return f[1];
    if (m1 === 1) return f[0];
    return f[2];
  }
  return n === 1 ? f[0] : f[1];
}

export function PublicToggles({ theme, lang, onTheme, onLang }) {
  const btn = { background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)", borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 700, lineHeight: 1, minWidth: 38 };
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 10 }}>
      <button style={btn} onClick={onLang} aria-label="language">{LANG_LABELS[lang] || lang.toUpperCase()}</button>
      <button style={btn} onClick={onTheme} aria-label="theme">{theme === "dark" ? "☀" : "☾"}</button>
    </div>
  );
}
