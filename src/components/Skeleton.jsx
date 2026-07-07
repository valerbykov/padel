// components/Skeleton.jsx
// Пульсирующий каркас карточки для первой загрузки списков (игры/турниры/история).
// Класс .plsk и @keyframes plsk определены в общем css PadelLeague (глобально).
import React from "react";

export function CardSkeleton({ count = 4 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", marginBottom: 8, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, opacity: i === count - 1 ? 0.6 : 1 }}>
          <div className="plsk" style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, animationDelay: `${i * 0.08}s` }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="plsk" style={{ width: "58%", height: 14, marginBottom: 8, animationDelay: `${i * 0.08 + 0.05}s` }} />
            <div className="plsk" style={{ width: "38%", height: 10, animationDelay: `${i * 0.08 + 0.1}s` }} />
          </div>
          <div className="plsk" style={{ width: 26, height: 14, flexShrink: 0, animationDelay: `${i * 0.08 + 0.15}s` }} />
        </div>
      ))}
    </>
  );
}
