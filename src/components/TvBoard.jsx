// TvBoard — полноэкранное табло турнира (ТВ клуба / планшет на стойке).
// Два режима: initial (ин-апп, данные от родителя) и code (публичный /tv/CODE,
// поллинг публичного RPC — реалтайм анониму не гарантирован).
import React, { useEffect, useMemo, useState } from "react";
import { getTournamentByCode } from "../lib/tournamentApi";
import { detailedStandings, pairStandings } from "../lib/americano";
import { fmtById } from "./Tournaments";
import { t as tr } from "../lib/i18n";

const S = {
  root: { position: "fixed", inset: 0, zIndex: 500, display: "flex", flexDirection: "column",
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

export default function TvBoard({ code = null, initial = null, onClose = null }) {
  const [t, setT] = useState(initial);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  useEffect(() => { if (initial) setT(initial); }, [initial]);
  useEffect(() => {
    if (!code || initial) return;
    let alive = true;
    const load = () => getTournamentByCode(code)
      .then((d) => { if (alive && d) { setT(d); setFetchedAt(Date.now()); } }).catch(() => {});
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
  const isPairFmt = !!fmt && fmt.category === "pair" && t.format !== "beat_the_box";
  const table = useMemo(() => {
    if (!t) return [];
    return isPairFmt ? pairStandings(t.players || [], t.matches || [])
                     : detailedStandings(t.players || [], t.matches || []);
  }, [t, isPairFmt]);
  const round = useMemo(() => (t?.matches || []).reduce((m, x) => Math.max(m, x.round_number || 0), 0), [t]);
  const courts = useMemo(() => (t?.matches || []).filter((m) => (m.round_number || 0) === round), [t, round]);
  const nameOf = (id) => (t?.players || []).find((p) => p.id === id)?.name || "—";
  const staleMin = Math.floor((Date.now() - fetchedAt) / 60000);

  if (!t) return <div style={S.root}><div style={{ color: "var(--mut)" }}>{tr("loading")}</div></div>;
  return (
    <div style={S.root}>
      <div style={S.top}>
        <span style={S.eyebrow}>🏆 {t.name || fmt.name} · {tr("trn_tv_round").replace("{n}", String(round))}</span>
        {code && staleMin > 1 && <span style={{ color: "var(--mut)", fontSize: "1.4vmin" }}>{tr("trn_tv_stale").replace("{n}", String(staleMin))}</span>}
        {onClose && <button onClick={onClose} style={S.close}>✕</button>}
      </div>
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
      <div style={S.foot}>padelpack.app/t/{t.invite_code}</div>
    </div>
  );
}
