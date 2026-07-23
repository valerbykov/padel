import React from "react";

// OpenBall — индикатор «эта строка открыта в детали справа». Лаймовый мяч без
// шва; половина торчит за правым краём карточки (master-detail-указатель).
// Тонкий ободок цветом карточки отделяет мяч от лаймового кольца active-строки.
export default function OpenBall({ size = 26, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      style={{ position: "absolute", right: -11, top: "50%", transform: "translateY(-50%)", zIndex: 4, filter: "drop-shadow(0 2px 4px rgba(0,0,0,.4))", ...style }}>
      <circle cx="12" cy="12" r="10.5" fill="var(--lime)" stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}
