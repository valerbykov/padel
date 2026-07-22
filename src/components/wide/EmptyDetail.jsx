// EmptyDetail — пустое состояние правой колонки. ТОЛЬКО из уже загруженных
// данных (Global Constraint: без новых запросов) — данные передаются пропсами.
import React from "react";

export default function EmptyDetail({ icon = "👈", title, sub, children }) {
  return (
    <div style={{ border: "1.5px dashed var(--line)", borderRadius: 18, padding: "28px 22px",
      textAlign: "center", color: "var(--mut)" }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>{icon}</div>
      {title && <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)", marginBottom: 4 }}>{title}</div>}
      {sub && <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{sub}</div>}
      {children}
    </div>
  );
}
