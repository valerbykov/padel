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
