// TvBoard — полноэкранное табло турнира (ТВ клуба / планшет на стойке).
// Два режима: initial (ин-апп, данные от родителя) и code (публичный /tv/CODE,
// поллинг публичного RPC — реалтайм анониму не гарантирован).
// Экран турнира вынесен в TvTournamentScreen и переиспользуется в ClubTv
// (единый «ТВ клуба» с ротацией экранов лиги — /tv/l/CODE).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getTournamentByCode } from "../lib/tournamentApi";
import { detailedStandings, pairStandings } from "../lib/americano";
import { fmtById } from "./Tournaments";
import { useWakeLock } from "../lib/useWakeLock";
import { t as tr } from "../lib/i18n";

// ТВ-табло — ВСЕГДА тёмное, независимо от темы устройства/приложения. Раньше оно
// брало var(--ink)/var(--surface)… из активной темы, и на планшете со светлой
// темой цифры счёта становились тёмными на тёмном боксе (не читались), таблица
// белела. Прибиваем палитру локально на корень (CSS-переменные наследуются
// детьми), плюс color-scheme:dark, чтобы всё табло рисовалось в тёмных тонах.
/* eslint-disable no-restricted-syntax -- намеренный фикс палитры темы: ТВ-табло
   всегда тёмное и НЕ зависит от темы устройства, поэтому здесь именно
   хардкод значений (иначе var(--...) снова утекли бы из светлой темы). */
const TV_VARS = {
  "--bg": "#0a1612", "--surface": "#11211b", "--surface2": "#16291f", "--line": "#22382c",
  "--ink": "#eef3ee", "--mut": "#7d9488", "--lime": "#c8ff2d", "--coral": "#ff6a52",
  "--yellow": "#ffd23f", "--lime-fg": "#0a1612", colorScheme: "dark",
};
/* eslint-enable no-restricted-syntax */

// Общие стили ТВ (экспортируются для ClubTv — единая визуальная система табло).
export const TV_S = {
  root: { ...TV_VARS, position: "fixed", inset: 0, zIndex: 500, display: "flex", flexDirection: "column",
    background: "linear-gradient(160deg,#122a20 0%, #0a1612 70%)", color: "var(--ink)",
    fontFamily: "'Outfit',sans-serif", padding: "3vmin 4vmin" },
  top: { display: "flex", alignItems: "center", gap: "2vmin" },
  eyebrow: { color: "var(--lime)", fontWeight: 900, fontSize: "2.6vmin", letterSpacing: ".2vmin", textTransform: "uppercase", flex: 1 },
  close: { background: "rgba(255,255,255,.08)", border: "1px solid var(--line)", color: "var(--ink)",
    borderRadius: "1.2vmin", fontSize: "2.2vmin", padding: ".6vmin 1.4vmin", cursor: "pointer" },
  body: { flex: 1, display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "3vmin", marginTop: "2.5vmin", minHeight: 0 },
  courts: { display: "flex", flexDirection: "column", gap: "2.5vmin", minHeight: 0 },
  court: { flex: 1, borderRadius: "2vmin", background: "linear-gradient(180deg,#2e5cb8,#274e9e)",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1vmin",
    boxShadow: "inset 0 0 0 .3vmin rgba(255,255,255,.2)", position: "relative" },
  courtLabel: { position: "absolute", top: "1.2vmin", fontSize: "1.6vmin", fontWeight: 800, letterSpacing: ".25vmin",
    background: "rgba(0,0,0,.4)", borderRadius: "3vmin", padding: ".4vmin 1.6vmin" },
  teams: { fontSize: "1.9vmin", fontWeight: 700, color: "#e6ecff", padding: "0 2vmin", textAlign: "center" },
  score: { background: "#0c1524", borderRadius: "1.6vmin", padding: "1vmin 3vmin", fontWeight: 900, fontSize: "6vmin",
    fontVariantNumeric: "tabular-nums" },
  tablePane: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "2vmin",
    padding: "2vmin", overflow: "hidden", display: "flex", flexDirection: "column", gap: ".6vmin" },
  th: { fontSize: "1.5vmin", fontWeight: 800, letterSpacing: ".25vmin", textTransform: "uppercase", color: "var(--mut)", marginBottom: ".8vmin" },
  trow: { display: "flex", alignItems: "center", gap: "1.4vmin", fontSize: "2.4vmin", fontWeight: 600,
    borderRadius: "1vmin", padding: ".7vmin 1vmin" },
  foot: { textAlign: "center", color: "var(--mut)", fontSize: "1.6vmin", fontWeight: 700, letterSpacing: ".15vmin", marginTop: "1.5vmin" },
};
const S = TV_S;

// Полноэкранное центрированное сообщение (загрузка / ошибка / не начался).
export function TvMessage({ text, muted = true, onClose = null }) {
  return (
    <div style={{ ...S.root, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ color: muted ? "var(--mut)" : "var(--ink)", fontSize: "3vmin", fontWeight: 700, maxWidth: "70vmin", whiteSpace: "pre-line" }}>{text}</div>
      {onClose && <button onClick={onClose} style={{ ...S.close, marginTop: "3vmin" }}>✕</button>}
    </div>
  );
}

// Экран одного турнира: корты текущего раунда + турнирная таблица. Данные — в t.
// bare=true — без обёртки S.root/шапки-eyebrow/футера (для встраивания в ClubTv,
// где своя хромота); иначе — самодостаточный полноэкранный экран.
export function TvTournamentScreen({ t, code = null, onClose = null, staleMin = 0, bare = false }) {
  const fmt = t ? fmtById(t.format) : null;
  const isPairFmt = !!fmt && fmt.category === "pair" && t.format !== "beat_the_box";
  const table = useMemo(() => {
    if (!t) return [];
    return isPairFmt ? pairStandings(t.players || [], t.matches || [])
                     : detailedStandings(t.players || [], t.matches || []);
  }, [t, isPairFmt]);
  // Текущий раунд = МИНИМАЛЬНЫЙ с несыгранными матчами (американо генерирует все
  // раунды заранее — max давал бы последний, а не текущий); всё сыграно → последний.
  const round = useMemo(() => {
    const ms = t?.matches || [];
    if (!ms.length) return 0;
    const unplayed = ms.filter((m) => m.score_a == null || m.score_b == null).map((m) => m.round_number || 1);
    return unplayed.length ? Math.min(...unplayed) : ms.reduce((mx, x) => Math.max(mx, x.round_number || 0), 0);
  }, [t]);
  const courts = useMemo(() => (t?.matches || []).filter((m) => (m.round_number || 0) === round), [t, round]);
  const nameOf = (id) => (t?.players || []).find((p) => p.id === id)?.name || "—";

  const head = (
    <div style={S.top}>
      <span style={S.eyebrow}>🏆 {t.name || fmt.name} · {tr("trn_tv_round").replace("{n}", String(round))}</span>
      {code && staleMin > 1 && <span style={{ color: "var(--mut)", fontSize: "1.4vmin" }}>{tr("trn_tv_stale").replace("{n}", String(staleMin))}</span>}
      {onClose && <button onClick={onClose} style={S.close}>✕</button>}
    </div>
  );
  const body = (
    <div style={S.body}>
      <div style={S.courts}>
        {courts.map((m) => (
          <div key={m.id} style={S.court}>
            <div style={S.courtLabel}>{t.court_names?.[String(m.court)] || `${tr("court_label")} ${m.court}`}</div>
            <div style={S.teams}>{nameOf(m.team_a?.[0])} & {nameOf(m.team_a?.[1])} — {nameOf(m.team_b?.[0])} & {nameOf(m.team_b?.[1])}</div>
            <div style={S.score}>{m.score_a ?? 0}<span style={{ color: "#8fa3c8" }}> : </span>{m.score_b ?? 0}</div>
          </div>
        ))}
      </div>
      <div style={S.tablePane}>
        <div style={S.th}>{tr("trn_pairs")} / {tr("rating")}</div>
        {table.slice(0, 10).map((r, i) => (
          <div key={r.id || i} style={{ ...S.trow, background: i === 0 ? "color-mix(in srgb, var(--lime) 10%, transparent)" : "none" }}>
            <span style={{ width: "3vmin", color: i === 0 ? "var(--lime)" : "var(--mut)", fontWeight: 800 }}>{i + 1}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || (r.names || []).join(" & ")}</span>
            <span style={{ fontWeight: 900, color: i === 0 ? "var(--lime)" : "var(--ink)" }}>{r.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
  if (bare) return <>{head}{body}</>;
  return (
    <div style={S.root}>
      {head}
      {body}
      <div style={S.foot}>padelpack.app/t/{t.invite_code}</div>
    </div>
  );
}

export default function TvBoard({ code = null, initial = null, onClose = null }) {
  const [t, setT] = useState(initial);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  // Состояние загрузки публичного /tv/CODE: null=грузим, "notfound"=нет турнира
  // (неверный/просроченный код → RPC вернул пусто), "neterr"=сбой сети/RPC.
  // Ошибку показываем только пока данных не было; после первой удачи —
  // молча держим последнее (табло на стойке не должно мигать на блипе сети).
  const [err, setErr] = useState(null);
  const loadedRef = useRef(!!initial);
  useWakeLock(true);   // экран-табло не гаснет по таймауту неактивности
  useEffect(() => { if (initial) { loadedRef.current = true; setT(initial); } }, [initial]);
  useEffect(() => {
    if (!code || initial) return;
    let alive = true;
    const load = () => getTournamentByCode(code)
      .then((d) => {
        if (!alive) return;
        if (d) { loadedRef.current = true; setT(d); setFetchedAt(Date.now()); setErr(null); }
        else if (!loadedRef.current) setErr("notfound");
      })
      .catch(() => { if (alive && !loadedRef.current) setErr("neterr"); });
    load();
    const id = setInterval(load, 12000);
    return () => { alive = false; clearInterval(id); };
  }, [code, initial]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fmt = t ? fmtById(t.format) : null;
  const staleMin = Math.floor((Date.now() - fetchedAt) / 60000);

  if (!t) {
    if (err === "notfound") return <TvMessage text={tr("trn_tv_notfound")} onClose={onClose} />;
    if (err === "neterr") return <TvMessage text={tr("trn_tv_neterr")} onClose={onClose} />;
    return <TvMessage text={tr("loading")} onClose={onClose} />;
  }
  // Турнир найден, но матчей ещё нет (не начат) — честное «не начался»,
  // а не пустая сетка кортов с «раунд 0».
  if (!(t.matches || []).length) return <TvMessage text={`🏆 ${t.name || fmt.name}\n${tr("trn_tv_notstarted")}`} muted={false} onClose={onClose} />;
  return <TvTournamentScreen t={t} code={code} onClose={onClose} staleMin={staleMin} />;
}
