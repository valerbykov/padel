// components/DogRunArt.jsx
// Пустое состояние «Игр», сцена-победитель пяти консилиумов (гибрид v6):
// ракетка на месте с первой секунды; понизу параллельно пробегает мини-пёс
// с мячом (ротоскоп из видео — настоящий бег лапами); мяч прилетает справа,
// ракетка отбивает (вздрагивает) — и рикошетом по дуге мяч ложится ровно на
// привычное место рядом с ракеткой, где остаётся покачиваться. Финальная
// статика идентична прежнему варианту «ракетка + мяч».
// Грузится лениво (отдельный чанк ~80КБ из-за кадров); replay — на каждый
// маунт (заход на вкладку) и по тапу; prefers-reduced-motion — сразу финал.
import React, { useRef } from "react";
import { RUN_FRAMES, RUN_TRANSFORM } from "./dogRunFrames";

const D = 2.6;          // длительность пробега, сек
const RUN_SHARE = 0.86; // доля цикла на кадры бега

const reducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch (e) { return false; }
};

// Ракетка + мяч (та же геометрия, что в прежнем EmptyState).
function Racket({ animated }) {
  return (
    <g opacity={animated ? 0 : 1}>
      {animated && <animate attributeName="opacity" begin="0.25s" dur="0.6s" values="0;1" fill="freeze" />}
      <g transform="translate(215,255) scale(2.4)">
        <g stroke="var(--lime)" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="50" cy="42" rx="30" ry="34" />
          <path d="M38 72 L46 98 M62 72 L54 98" />
          <path d="M46 98 H54" />
          {animated && (
            <>
              <animateTransform attributeName="transform" type="rotate" additive="sum" begin="3.25s" dur="0.5s"
                values="0 50 102; -5 50 102; 2.5 50 102; 0 50 102" keyTimes="0;0.3;0.7;1" fill="freeze" />
              <animateTransform attributeName="transform" type="rotate"
                values="-2.5 50 102; 2.5 50 102; -2.5 50 102" dur="4s" begin="4.1s" repeatCount="indefinite" />
            </>
          )}
        </g>
        <g fill="var(--lime)">
          <circle cx="40" cy="32" r="3.1" /><circle cx="52" cy="28" r="3.1" /><circle cx="64" cy="32" r="3.1" />
          <circle cx="38" cy="44" r="3.1" /><circle cx="50" cy="42" r="3.1" /><circle cx="62" cy="44" r="3.1" />
          <circle cx="44" cy="56" r="3.1" /><circle cx="56" cy="56" r="3.1" />
        </g>
        {/* Мяч на привычном месте: в анимации «приземляется» сюда рикошетом */}
        <g opacity={animated ? 0 : 1}>
          {animated && <animate attributeName="opacity" begin="3.86s" dur="0.02s" values="0;1" fill="freeze" />}
          <circle cx="92" cy="80" r="15" fill="var(--lime)" />
          <path d="M83 69 a15 15 0 0 1 0 22" stroke="var(--lime-fg)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          {animated && (
            <animateTransform attributeName="transform" type="translate" values="0 0; 0 -6; 0 0" dur="1.8s" begin="4.1s"
              calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1" repeatCount="indefinite" />
          )}
        </g>
      </g>
    </g>
  );
}

export default function DogRunArt() {
  const svgRef = useRef(null);
  const still = reducedMotion();
  const replay = () => { try { svgRef.current?.setCurrentTime(0); } catch (e) {} };

  if (still) {
    return (
      <svg viewBox="0 150 720 540" style={{ width: "100%", maxWidth: 300, display: "block" }} aria-hidden="true">
        <Racket animated={false} />
      </svg>
    );
  }

  return (
    <svg ref={svgRef} onClick={replay} viewBox="0 150 720 540"
      style={{ width: "100%", maxWidth: 300, display: "block", cursor: "pointer" }} aria-hidden="true">
      {/* Мини-пёс с мячом пробегают по самому низу (не пересекаются с ракеткой) */}
      <g transform="translate(234,439) scale(0.35)" opacity="0.6">
        <path d="M20 676 H700" stroke="var(--lime)" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.3">
          <animate attributeName="opacity" begin="2.6s" dur="0.6s" values="0.3;0" fill="freeze" />
        </path>
        {/* мяч катится впереди */}
        <g opacity="0">
          <animate attributeName="opacity" dur={`${D}s`} repeatCount="1" calcMode="discrete" keyTimes="0;0.005;0.30;1" values="0;1;0;0" />
          <animateTransform attributeName="transform" type="translate" dur={`${D}s`} repeatCount="1"
            values="305 0; 820 0; 820 0" keyTimes="0;0.28;1" />
          <g transform="translate(0,645)">
            <g>
              <animateTransform attributeName="transform" type="rotate" values="0;1440" keyTimes="0;1" dur="0.78s" repeatCount="2" />
              <circle cx="0" cy="0" r="34" fill="var(--lime)" />
              <path d="M-19 -25 a34 34 0 0 1 0 50" stroke="var(--lime-fg)" strokeWidth="6" fill="none" strokeLinecap="round" />
            </g>
          </g>
        </g>
        {/* кадры бега */}
        {RUN_FRAMES.map((d, i) => {
          const t0 = Math.max(i / RUN_FRAMES.length * RUN_SHARE, 0.0001).toFixed(4);
          const t1 = ((i + 1) / RUN_FRAMES.length * RUN_SHARE).toFixed(4);
          return (
            <path key={i} d={d} transform={RUN_TRANSFORM} fill="none" stroke="var(--lime)" strokeWidth="3"
              vectorEffect="non-scaling-stroke" strokeLinejoin="round" opacity="0">
              <animate attributeName="opacity" dur={`${D}s`} repeatCount="1" calcMode="discrete"
                keyTimes={`0;${t0};${t1};1`} values="0;1;0;0" />
            </path>
          );
        })}
      </g>

      <Racket animated />

      {/* Ралли-мяч: прилетает справа, удар о струны, рикошет в точку покоя */}
      <g opacity="0">
        <animate attributeName="opacity" begin="2.9s" dur="0.04s" values="0;1" fill="freeze" />
        <animate attributeName="opacity" begin="3.86s" dur="0.02s" values="1;0" fill="freeze" />
        <g transform="translate(0,356)">
          <g>
            <animateTransform attributeName="transform" type="translate" begin="2.9s" dur="0.35s"
              values="790 0; 350 0" calcMode="spline" keySplines="0.35 0 0.75 1" fill="freeze" />
            <animateTransform attributeName="transform" type="translate" begin="3.25s" dur="0.6s"
              values="350 0; 402 -38; 436 91" keyTimes="0;0.45;1" calcMode="spline"
              keySplines="0.3 0 0.6 1; 0.35 0 0.65 1" fill="freeze" />
            <circle r="36" fill="var(--lime)" />
            <path d="M-20 -26 a36 36 0 0 1 0 52" stroke="var(--lime-fg)" strokeWidth="6.2" fill="none" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </svg>
  );
}
