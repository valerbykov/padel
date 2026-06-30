// lib/level.js — уровень игрока по числу матчей и рейтингу.
// Вынесено из PadelLeague, чтобы публичная страница лиги могла показывать
// уровни, не подтягивая тяжёлый чанк лиги. Цвета — CSS-переменные/хексы.
import { t } from "./i18n";

export function playerLevel(matches, rating) {
  if (rating >= 1200) return { label: t("level_legend"), color: "var(--yellow)" };
  if (matches >= 50)  return { label: t("level_master"), color: "var(--lime)" };
  if (matches >= 20)  return { label: t("level_experienced"), color: "#7ec8e3" };
  if (matches >= 5)   return { label: t("level_amateur"), color: "#a0d890" };
  return { label: t("level_beginner"), color: "var(--mut)" };
}
