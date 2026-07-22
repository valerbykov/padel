// WideSplit — две колонки на wide: список 340px + деталь. Деталь-компоненты
// телефона рендерятся как есть, колонкой ≤560px (Global Constraint).
import React from "react";

export default function WideSplit({ list, detail, empty }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
      <div style={{ minWidth: 0 }}>{list}</div>
      <div style={{ minWidth: 0, position: "sticky", top: 12 }}>
        <div style={{ maxWidth: 560 }}>{detail || empty || null}</div>
      </div>
    </div>
  );
}
