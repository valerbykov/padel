// lib/levels.js
// Самозаявленный уровень игрока. Единого мирового стандарта нет: Playtomic 0–7 —
// ближе всего к общему; буквы (РФ) — локально; «другое» — свободно (Аргентина/NTRP).
// Модель бейджа: { sys: "pt"|"ltr"|"oth", val: string, lbl?: string }.

export const LEVEL_SYSTEMS = ["pt", "ltr", "oth"];
export const LETTER_OPTIONS = ["E", "D", "D+", "C", "C+", "B", "A"];

// Строка для бейджа. Playtomic — бренд, не переводим.
export function formatLevel(lvl) {
  if (!lvl || typeof lvl !== "object") return "";
  const val = (lvl.val == null ? "" : String(lvl.val)).trim();
  if (!val) return "";
  if (lvl.sys === "pt") return `Playtomic ${val}`;
  if (lvl.sys === "oth") return `${(lvl.lbl || "").trim()} ${val}`.trim();
  return val; // ltr
}

// Событийный уровень (для турнира/игры): как formatLevel, но с диапазоном val2.
export function formatEventLevel(lvl) {
  if (!lvl || typeof lvl !== "object") return "";
  const v = (lvl.val == null ? "" : String(lvl.val)).trim();
  if (!v) return "";
  const v2 = (lvl.val2 == null ? "" : String(lvl.val2)).trim();
  const range = v2 && v2 !== v ? `${v}–${v2}` : v; // en-dash
  if (lvl.sys === "pt") return `Playtomic ${range}`;
  if (lvl.sys === "oth") return `${(lvl.lbl || "").trim()} ${range}`.trim();
  return range; // ltr
}

// Санитайзер событийного уровня (с опциональным val2 — верхней границей диапазона).
export function sanitizeEventLevel(lvl) {
  if (!lvl || typeof lvl !== "object") return null;
  if (!LEVEL_SYSTEMS.includes(lvl.sys)) return null;
  const val = String(lvl.val || "").trim();
  if (!val) return null;
  const out = { sys: lvl.sys, val };
  const val2 = String(lvl.val2 || "").trim();
  if (val2 && val2 !== val) out.val2 = val2;
  if (lvl.sys === "oth" && String(lvl.lbl || "").trim()) out.lbl = String(lvl.lbl).trim();
  return out;
}

// Оставляет только валидные записи (известная система + непустое значение).
export function sanitizeLevels(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((l) => l && typeof l === "object" && LEVEL_SYSTEMS.includes(l.sys) && String(l.val || "").trim())
    .map((l) => {
      const out = { sys: l.sys, val: String(l.val).trim() };
      if (l.sys === "oth" && String(l.lbl || "").trim()) out.lbl = String(l.lbl).trim();
      return out;
    });
}
