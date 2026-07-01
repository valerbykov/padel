// components/RfNotice.jsx
// Информационная плашка: приложение работает нестабильно в РФ. Показывается
// только пользователям из РФ (по гео — тот же детектор, что скрывает Google).
// Используется на экране входа и на welcome-экране.
import React, { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { t } from "../lib/i18n";
import { isRussiaSync, detectRegion } from "../lib/region";

export default function RfNotice({ style }) {
  const [show, setShow] = useState(() => isRussiaSync());
  useEffect(() => {
    let alive = true;
    detectRegion().then((ru) => { if (alive) setShow(!!ru); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!show) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 9, padding: "10px 12px",
      background: "color-mix(in srgb, var(--yellow) 13%, transparent)",
      border: "1px solid color-mix(in srgb, var(--yellow) 38%, transparent)",
      borderRadius: 12, fontFamily: "'Outfit',sans-serif", ...style,
    }}>
      <AlertTriangle size={16} style={{ color: "var(--yellow)", flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.35 }}>{t("app_unstable_rf")}</span>
    </div>
  );
}
