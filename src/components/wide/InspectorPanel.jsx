// InspectorPanel — шасси премиум-инспектора (спека: v1 за флагом, наполнение — проект
// «премиум-аналитика»). Флаг: localStorage.pp_inspector === "1".
import React from "react";
import { t } from "../../lib/i18n";

export const inspectorEnabled = () => {
  try { return localStorage.getItem("pp_inspector") === "1"; } catch (e) { return false; }
};

export default function InspectorPanel({ context }) {
  if (!inspectorEnabled()) return null;
  return (
    <div style={{ width: 300, flexShrink: 0, borderLeft: "1.5px dashed color-mix(in srgb, var(--yellow) 45%, transparent)",
      padding: "14px 14px", minHeight: "60vh" }}>
      <div style={{ color: "var(--yellow)", fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>{t("inspector_badge")}</div>
      <div style={{ color: "var(--mut)", fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
        {t("inspector_hint").replace("{ctx}", context || "—")}
      </div>
    </div>
  );
}
