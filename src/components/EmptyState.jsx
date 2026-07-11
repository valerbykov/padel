// components/EmptyState.jsx
// Иллюстрированные пустые состояния в стиле бренда (лаймовая линия + мяч).
// Лёгкая анимация через SMIL (animateTransform): мяч подпрыгивает, у часов
// идут стрелки, ракетка чуть покачивается. Шов мяча — var(--lime-fg), чтобы
// контрастировал и в тёмной, и в светлой теме.
// variant: "run" (Игры) | "podium" (Турниры) | "clock" (История) | "racket".
// Все три вкладки — анимированные сцены из DogRunArt (формула-победитель
// консилиумов: композиция сразу + мини-пёс понизу + непрерывная физика мяча);
// тяжёлые кадры пса грузятся лениво одним чанком, на время загрузки — статичный
// line-art (ракетка/подиум/часы ниже).
import React, { Suspense, lazy } from "react";

const DogRunArt = lazy(() => import("./DogRunArt"));
// variant → сцена в DogRunArt; статичный Art того же вида — fallback на время
// загрузки. Дефолтный "racket" (мелкие пустые состояния фильтров и т.п.)
// остаётся статичным — сцену с псом там играть незачем.
const SCENE_KIND = { run: "racket", podium: "podium", clock: "clock" };

function Ball({ cx, cy, r }) {
  const sx = cx - Math.round(r * 0.6);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="var(--lime)" />
      <path d={`M${sx} ${cy - r + 4} a${r} ${r} 0 0 1 0 ${2 * r - 8}`} stroke="var(--lime-fg)" strokeWidth={r > 13 ? 2.6 : 2.3} fill="none" strokeLinecap="round" />
      <animateTransform attributeName="transform" attributeType="XML" type="translate"
        values="0 0; 0 -6; 0 0" keyTimes="0;0.5;1" dur="1.8s"
        calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1" repeatCount="indefinite" />
    </g>
  );
}

function RacketBall() {
  return (
    <svg width="116" height="116" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <g>
        <g stroke="var(--lime)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="50" cy="42" rx="30" ry="34" />
          <path d="M38 72 L46 98 M62 72 L54 98" />
          <path d="M46 98 H54" />
        </g>
        <g fill="var(--lime)">
          <circle cx="40" cy="32" r="3.1" /><circle cx="52" cy="28" r="3.1" /><circle cx="64" cy="32" r="3.1" />
          <circle cx="38" cy="44" r="3.1" /><circle cx="50" cy="42" r="3.1" /><circle cx="62" cy="44" r="3.1" />
          <circle cx="44" cy="56" r="3.1" /><circle cx="56" cy="56" r="3.1" />
        </g>
        <animateTransform attributeName="transform" attributeType="XML" type="rotate"
          values="-2.5 50 102; 2.5 50 102; -2.5 50 102" keyTimes="0;0.5;1" dur="4s"
          calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1" repeatCount="indefinite" />
      </g>
      <Ball cx={92} cy={80} r={15} />
    </svg>
  );
}

function Podium() {
  const D = "6s";
  // тумба: появляется (fade + лёгкий подъём) в своём окне, затем держится
  const Bar = ({ x, y, w, h, k0, k1 }) => (
    <g opacity="0">
      <rect x={x} y={y} width={w} height={h} rx="3" stroke="var(--lime)" strokeWidth="5" fill="none" strokeLinejoin="round" />
      <animate attributeName="opacity" values="0;0;1;1;1" keyTimes={`0;${k0};${k1};0.95;1`} dur={D} repeatCount="indefinite" />
      <animateTransform attributeName="transform" type="translate" values="0 12;0 12;0 0;0 0;0 0" keyTimes={`0;${k0};${k1};0.95;1`} dur={D} calcMode="spline" keySplines="0 0 1 1;0.2 0.7 0.3 1;0 0 1 1;0 0 1 1" repeatCount="indefinite" />
    </g>
  );
  return (
    <svg width="116" height="116" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <path d="M6 106 H114" stroke="var(--lime)" strokeWidth="5" strokeLinecap="round" />
      <Bar x="74" y="86" w="32" h="18" k0="0.05" k1="0.16" />
      <Bar x="14" y="80" w="32" h="24" k0="0.20" k1="0.31" />
      <Bar x="44" y="64" w="32" h="40" k0="0.34" k1="0.45" />
      <g opacity="0">
        <circle cx="60" cy="44" r="14" fill="var(--lime)" />
        <path d="M52 34 a14 14 0 0 1 0 20" stroke="var(--lime-fg)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <animate attributeName="opacity" values="0;0;1;1;1" keyTimes="0;0.49;0.51;0.95;1" dur={D} repeatCount="indefinite" />
        <animateTransform attributeName="transform" type="translate" values="0 -80;0 -80;0 0;0 -10;0 0;0 0" keyTimes="0;0.49;0.62;0.69;0.78;1" dur={D} calcMode="spline" keySplines="0 0 1 1;0.45 0 1 1;0 0 0.3 1;0.4 0 0.6 1;0 0 1 1" repeatCount="indefinite" />
      </g>
    </svg>
  );
}

function Clock() {
  return (
    <svg width="116" height="116" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <g stroke="var(--lime)" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="54" cy="54" r="34" />
        <path d="M54 24 V30 M54 78 V84 M24 54 H30 M78 54 H84" />
      </g>
      <g>
        <line x1="54" y1="54" x2="54" y2="38" stroke="var(--lime)" strokeWidth="5" strokeLinecap="round" />
        <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 54 54" to="360 54 54" dur="48s" repeatCount="indefinite" />
      </g>
      <g>
        <line x1="54" y1="54" x2="72" y2="54" stroke="var(--lime)" strokeWidth="4" strokeLinecap="round" />
        <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 54 54" to="360 54 54" dur="8s" repeatCount="indefinite" />
      </g>
      <circle cx="54" cy="54" r="3.4" fill="var(--lime)" />
      <Ball cx={94} cy={94} r={12} />
    </svg>
  );
}

const ART = { racket: RacketBall, podium: Podium, clock: Clock };

export default function EmptyState({ text, children, className = "pl-card", variant = "racket" }) {
  const Art = ART[variant] || RacketBall;
  return (
    <div className={className} style={{ padding: "30px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      {SCENE_KIND[variant]
        ? <Suspense fallback={<Art />}><DogRunArt kind={SCENE_KIND[variant]} /></Suspense>
        : <Art />}
      <div style={{ color: "var(--mut)", fontSize: 14, maxWidth: 290, lineHeight: 1.5 }}>{text}</div>
      {children}
    </div>
  );
}
