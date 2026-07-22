// wide.js — инфраструктура широкоэкранной раскладки (≥900px).
// Телефонная версия (<900px) не знает об этих модулях вовсе.
import { useEffect, useState } from "react";

const WIDE_QUERY = "(min-width: 900px)";

export function useIsWide() {
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(WIDE_QUERY).matches : false);
  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const on = (e) => setWide(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

// useRailExpanded — морфинг рейла в сайдбар с подписями на ≥1280px. Состояние
// (свернут/развёрнут) переживает перезагрузку (localStorage); фактическое
// expanded всегда учитывает текущую ширину экрана (canExpand).
export function useRailExpanded() {
  const [exp, setExp] = useState(() => {
    try { return localStorage.getItem("pp_rail_exp") === "1"; } catch (e) { return false; }
  });
  const toggle = () => setExp((v) => { const n = !v; try { localStorage.setItem("pp_rail_exp", n ? "1" : "0"); } catch (e) {} return n; });
  const [canExpand, setCanExpand] = useState(() => window.matchMedia("(min-width: 1280px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const on = (e) => setCanExpand(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return { expanded: exp && canExpand, canExpand, toggle };
}
