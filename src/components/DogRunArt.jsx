// components/DogRunArt.jsx
// Анимированные пустые состояния (формула-победитель пяти консилиумов):
// главная композиция на месте с первой секунды; понизу параллельно пробегает
// мини-пёс с мячом (ротоскоп из видео — настоящий бег лапами); мяч прилетает
// с непрерывной физикой и завершает сцену привычной статикой.
//   kind="racket" — Игры:   удар о струны → рикошет на привычное место;
//   kind="podium" — Турниры: мяч по дуге с отскоками занимает 1-ю ступень;
//   kind="clock"  — История: мяч стукается о часы («время пошло») и ложится рядом.
// Грузится лениво (общий чанк с кадрами пса); replay — на каждый маунт и по
// тапу; prefers-reduced-motion — сразу финальная статика.
import React, { useRef } from "react";
import { RUN_FRAMES, RUN_TRANSFORM } from "./dogRunFrames";

const D = 2.6;          // длительность пробега, сек
const RUN_SHARE = 0.86; // доля цикла на кадры бега

const reducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch (e) { return false; }
};

// Мини-пёс с мячом, пробегающие по нижней кромке.
function DogBg() {
  return (
    <g transform="translate(234,439) scale(0.35)" opacity="0.6">
      <path d="M20 676 H700" stroke="var(--lime)" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.3">
        <animate attributeName="opacity" begin="2.6s" dur="0.6s" values="0.3;0" fill="freeze" />
      </path>
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
  );
}

const Seam = ({ r, w }) => (
  <path d={`M${-r * 0.55} ${-r * 0.72} a${r} ${r} 0 0 1 0 ${r * 1.44}`}
    stroke="var(--lime-fg)" strokeWidth={w} fill="none" strokeLinecap="round" />
);

/* ── Игры: ракетка + рикошет ─────────────────────────────────────────────── */
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

function RacketScene() {
  return (
    <>
      <DogBg />
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
            <circle r="36" fill="var(--lime)" /><Seam r={36} w={6.2} />
          </g>
        </g>
      </g>
    </>
  );
}

/* ── Турниры: мяч занимает первое место ──────────────────────────────────── */
function PodiumBars({ animated }) {
  return (
    <g opacity={animated ? 0 : 1}>
      {animated && <animate attributeName="opacity" begin="0.25s" dur="0.6s" values="0;1" fill="freeze" />}
      <g transform="translate(215,255) scale(2.4)">
        <g stroke="var(--lime)" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 106 H114" />
          <rect x="74" y="86" width="32" height="18" rx="3" />
          <rect x="14" y="80" width="32" height="24" rx="3" />
          <rect x="44" y="64" width="32" height="40" rx="3" />
          {animated && (
            <animateTransform attributeName="transform" type="translate" additive="sum" begin="3.32s" dur="0.4s"
              values="0 0; 0 2.5; 0 0" keyTimes="0;0.4;1" fill="freeze" />
          )}
        </g>
      </g>
    </g>
  );
}

function PodiumScene({ still = false }) {
  if (still) {
    return (
      <>
        <PodiumBars animated={false} />
        <g transform="translate(359,373)"><circle r="34" fill="var(--lime)" /><Seam r={34} w={6} /></g>
      </>
    );
  }
  return (
    <>
      <DogBg />
      <PodiumBars animated />
      {/* Мяч: дуга справа, два затухающих отскока, ложится на 1-ю ступень */}
      <g opacity="0">
        <animate attributeName="opacity" begin="2.9s" dur="0.04s" values="0;1" fill="freeze" />
        <g>
          <animateTransform attributeName="transform" type="translate" begin="2.9s" dur="1.35s"
            values="770 240; 560 175; 359 373; 328 300; 305 373; 320 340; 336 373; 359 373"
            keyTimes="0;0.18;0.32;0.5;0.66;0.79;0.9;1"
            calcMode="spline" keySplines="0.3 0 0.7 1;0.35 0 0.7 1;0.3 0 0.6 1;0.4 0 0.7 1;0.3 0 0.6 1;0.4 0 0.7 1;0.35 0 0.65 1" fill="freeze" />
          <g>
            <circle r="34" fill="var(--lime)" /><Seam r={34} w={6} />
            <animateTransform attributeName="transform" type="translate" values="0 0; 0 -5; 0 0" dur="1.8s" begin="4.5s"
              calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1" repeatCount="indefinite" />
          </g>
        </g>
      </g>
    </>
  );
}

/* ── История: мяч «заводит время» ────────────────────────────────────────── */
function ClockFace({ animated }) {
  return (
    <g opacity={animated ? 0 : 1}>
      {animated && <animate attributeName="opacity" begin="0.25s" dur="0.6s" values="0;1" fill="freeze" />}
      <g transform="translate(215,255) scale(2.4)">
        <g>
          <g stroke="var(--lime)" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="54" cy="54" r="34" />
            <path d="M54 24 V30 M54 78 V84 M24 54 H30 M78 54 H84" />
          </g>
          <g>
            <line x1="54" y1="54" x2="54" y2="38" stroke="var(--lime)" strokeWidth="5" strokeLinecap="round" />
            <animateTransform attributeName="transform" type="rotate" from="0 54 54" to="360 54 54" dur="48s" repeatCount="indefinite" />
          </g>
          <g>
            <line x1="54" y1="54" x2="72" y2="54" stroke="var(--lime)" strokeWidth="4" strokeLinecap="round" />
            {animated ? (
              <>
                {/* быстрый оборот «время пошло» при ударе мяча, затем обычный ход */}
                <animateTransform attributeName="transform" type="rotate" begin="3.3s" dur="0.9s"
                  values="0 54 54; 360 54 54" calcMode="spline" keySplines="0.3 0 0.4 1" fill="freeze" />
                <animateTransform attributeName="transform" type="rotate" from="0 54 54" to="360 54 54" begin="4.2s" dur="8s" repeatCount="indefinite" />
              </>
            ) : (
              <animateTransform attributeName="transform" type="rotate" from="0 54 54" to="360 54 54" dur="8s" repeatCount="indefinite" />
            )}
          </g>
          <circle cx="54" cy="54" r="3.4" fill="var(--lime)" />
          {animated && (
            <animateTransform attributeName="transform" type="translate" additive="sum" begin="3.3s" dur="0.35s"
              values="0 0; 2.5 0; -1.5 0; 0 0" keyTimes="0;0.3;0.65;1" fill="freeze" />
          )}
        </g>
      </g>
    </g>
  );
}

function ClockScene({ still = false }) {
  if (still) {
    return (
      <>
        <ClockFace animated={false} />
        <g transform="translate(441,481)"><circle r="29" fill="var(--lime)" /><Seam r={29} w={5.2} /></g>
      </>
    );
  }
  return (
    <>
      <DogBg />
      <ClockFace animated />
      {/* Мяч: прилетает, стукается о корпус часов и отскакивает на привычное место */}
      <g opacity="0">
        <animate attributeName="opacity" begin="2.9s" dur="0.04s" values="0;1" fill="freeze" />
        <g>
          <animateTransform attributeName="transform" type="translate" begin="2.9s" dur="0.4s"
            values="780 330; 428 384" calcMode="spline" keySplines="0.35 0 0.75 1" fill="freeze" />
          <animateTransform attributeName="transform" type="translate" begin="3.3s" dur="0.55s"
            values="428 384; 448 420; 441 481" keyTimes="0;0.5;1" calcMode="spline"
            keySplines="0.3 0 0.6 1;0.35 0 0.65 1" fill="freeze" />
          <g>
            <circle r="29" fill="var(--lime)" /><Seam r={29} w={5.2} />
            <animateTransform attributeName="transform" type="translate" values="0 0; 0 -5; 0 0" dur="1.8s" begin="4.2s"
              calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1" repeatCount="indefinite" />
          </g>
        </g>
      </g>
    </>
  );
}

const SCENES = {
  racket: { anim: RacketScene, still: () => <Racket animated={false} /> },
  podium: { anim: PodiumScene, still: () => <PodiumScene still /> },
  clock:  { anim: ClockScene,  still: () => <ClockScene still /> },
};

export default function DogRunArt({ kind = "racket" }) {
  const svgRef = useRef(null);
  const scene = SCENES[kind] || SCENES.racket;
  const still = reducedMotion();
  const replay = () => { try { svgRef.current?.setCurrentTime(0); } catch (e) {} };
  const Body = still ? scene.still : scene.anim;
  return (
    <svg ref={svgRef} onClick={still ? undefined : replay} viewBox="0 150 720 540"
      style={{ width: "100%", maxWidth: 300, display: "block", cursor: still ? "default" : "pointer" }} aria-hidden="true">
      <Body />
    </svg>
  );
}
