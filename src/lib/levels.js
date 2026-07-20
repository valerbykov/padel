// lib/levels.js
// Самозаявленный уровень игрока. Единого мирового стандарта нет: Playtomic 0–7 —
// ближе всего к общему; буквы (РФ) — локально; «другое» — свободно (Аргентина/NTRP).
// Модель бейджа: { sys: "pt"|"ltr"|"oth", val: string, lbl?: string }.

export const LEVEL_SYSTEMS = ["pt", "ltr", "oth"];
export const LETTER_OPTIONS = ["E", "D", "D+", "C", "C+", "B", "A"];

// Префикс системы в бейдже. Playtomic и Lunda — бренды, не переводим.
function sysPrefix(sys, lbl) {
  if (sys === "pt") return "Playtomic";
  if (sys === "ltr") return "Lunda";
  return (lbl || "").trim(); // oth
}

// Строка для бейджа уровня игрока (одно значение).
export function formatLevel(lvl) {
  if (!lvl || typeof lvl !== "object") return "";
  const val = (lvl.val == null ? "" : String(lvl.val)).trim();
  if (!val) return "";
  return `${sysPrefix(lvl.sys, lvl.lbl)} ${val}`.trim();
}

// Значения событийного уровня: новый мультивыбор (vals[]) ИЛИ легаси val/val2.
function eventVals(lvl) {
  let vals = Array.isArray(lvl.vals) ? lvl.vals : [];
  if (!vals.length) vals = [lvl.val, lvl.val2];
  return [...new Set(vals.map((x) => String(x == null ? "" : x).trim()).filter(Boolean))];
}

// Событийный уровень (турнир/игра): множественный выбор принимаемых уровней.
export function formatEventLevel(lvl) {
  if (!lvl || typeof lvl !== "object") return "";
  // Легаси-диапазон {val,val2} (без vals) рендерим как «val–val2»; новый
  // мультивыбор {vals} — списком «a, b, c».
  if (!Array.isArray(lvl.vals)) {
    const v = String(lvl.val == null ? "" : lvl.val).trim();
    const v2 = String(lvl.val2 == null ? "" : lvl.val2).trim();
    if (v && v2 && v2 !== v) return `${sysPrefix(lvl.sys, lvl.lbl)} ${v}–${v2}`.trim();
  }
  const vals = eventVals(lvl);
  if (!vals.length) return "";
  return `${sysPrefix(lvl.sys, lvl.lbl)} ${vals.join(", ")}`.trim();
}

// Санитайзер событийного уровня: канонизирует vals (уник, порядок по «лестнице»).
export function sanitizeEventLevel(lvl) {
  if (!lvl || typeof lvl !== "object") return null;
  if (!LEVEL_SYSTEMS.includes(lvl.sys)) return null;
  let vals = eventVals(lvl);
  if (!vals.length) return null;
  if (lvl.sys === "ltr") vals.sort((a, b) => LETTER_OPTIONS.indexOf(a) - LETTER_OPTIONS.indexOf(b));
  else if (lvl.sys === "pt") vals.sort((a, b) => parseFloat(a) - parseFloat(b));
  const out = { sys: lvl.sys, vals };
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
