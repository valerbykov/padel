// components/Tournaments.jsx
// Турниры: Американо, Мексикано, King of the Hill, Beat the Box.
// Создание (2 шага: FormatPicker → конфиг), лобби, раунды, итоги.
import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { createPortal } from "react-dom";
import {
  createTournament, listTournaments, getTournament, addTournamentPlayer, removeTournamentPlayer,
  startTournament, submitMatchScore, finishTournament, tournamentLink, deleteTournament, listMyTournaments, copyTournament,
  generateMexicanoRound, generateKotHRound, generateKotHLadderRound, setCourtName, setScorePin, checkScorePin,
} from "../lib/tournamentApi";
import { standings, detailedStandings, allMatchesPlayed } from "../lib/americano";
import { dogAvatar } from "../lib/avatar";
import Fab from "./Fab";
import { getAllKotHTeams } from "../lib/mexicano";
import CourtView from "./CourtView";

// Конфетти/хлопушки: лёгкий самодостаточный эффект (без внешних либ). burst — нонс:
// меняется → залп. Портал в body, position:fixed, авто-очистка.
function Confetti({ burst }) {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (!burst) return;
    const colors = ["#c8ff2d", "#ffd23f", "#e5556a", "#3ddc84", "#5aa0ff", "#ff9f43", "#ffffff"];
    const arr = Array.from({ length: 80 }, (_, i) => ({
      id: burst + "-" + i,
      left: Math.random() * 100,
      bg: colors[i % colors.length],
      delay: Math.random() * 0.35,
      dur: 1.8 + Math.random() * 1.6,
      size: 6 + Math.random() * 7,
      dx: Math.round((Math.random() * 2 - 1) * 130),
    }));
    setPieces(arr);
    const t = setTimeout(() => setPieces([]), 3600);
    return () => clearTimeout(t);
  }, [burst]);
  if (!pieces.length) return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      <style>{`@keyframes ppConfetti{0%{transform:translate(0,-12vh) rotate(0);opacity:1}100%{transform:translate(var(--dx),112vh) rotate(720deg);opacity:.85}}`}</style>
      {pieces.map((p) => (
        <span key={p.id} style={{ position: "absolute", top: 0, left: p.left + "%", width: p.size, height: p.size * 0.6, background: p.bg, borderRadius: 2, "--dx": p.dx + "px", animation: `ppConfetti ${p.dur}s linear ${p.delay}s forwards` }} />
      ))}
    </div>,
    document.body
  );
}

import StandingsTable from "./StandingsTable";
import Avatar from "./Avatar";
import EmptyState from "./EmptyState";
import { Trophy, PlusCircle, Copy, Play, X, ArrowLeft, RefreshCw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Share2, Trash2, Plus, Check, Calendar, MapPin } from "lucide-react";
import { t as tr } from "../lib/i18n";
const nowLocalDT = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.tr-root{font-family:'Outfit',sans-serif;color:var(--ink);}
.tr-d{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;}
.tr-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px;}
.tr-btn{background:var(--lime);color:var(--lime-fg);font-weight:700;border:none;border-radius:14px;cursor:pointer;}
.tr-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
.tr-ghost{background:var(--surface2);color:var(--ink);border:1px solid var(--line);border-radius:14px;cursor:pointer;}
.tr-input,.tr-select{background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);font-family:'Outfit';font-size:16px;outline:none;width:100%;padding:10px 12px;box-sizing:border-box;transition:border-color .15s,box-shadow .15s;}
.tr-input:focus,.tr-select:focus{border-color:var(--lime);box-shadow:0 0 0 3px color-mix(in srgb,var(--lime) 18%,transparent);}
.tr-input::placeholder{color:var(--mut);}
.tr-codebox{font-family:'Outfit';font-weight:800;letter-spacing:6px;font-size:28px;color:var(--lime);text-align:center;background:var(--surface2);border:1px dashed var(--line);border-radius:14px;padding:10px;}
.tr-badge{font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;}
.tr-root{padding-bottom:4px;}
@media(max-width:400px){
  .tr-card{padding:10px;}
  .tr-d{letter-spacing:.3px;}
  .tr-input,.tr-select{padding:8px 10px;}
  .tr-codebox{font-size:22px;letter-spacing:4px;padding:8px;}
}
`;

// ─── Format metadata (non-translatable) ───────────────────────────────────────
const FORMAT_META = {
  americano:    { emoji: "🔄", color: "#b8ef28", multiOf: 4 },
  mexicano:     { emoji: "📊", color: "var(--yellow)", multiOf: 4 },
  king_of_hill: { emoji: "⛰️", color: "#ff9d3f", multiOf: 4 },
  beat_the_box: { emoji: "📦", color: "#ff6a52", multiOf: 2 },
};

function getFormats() {
  return [
    { id: "americano",    ...FORMAT_META.americano,
      name: tr("fmt_americano_name"), tagline: tr("fmt_americano_tagline"), desc: tr("fmt_americano_desc"),
      tags: [tr("fmt_americano_t1"), tr("fmt_americano_t2"), tr("fmt_americano_t3")] },
    { id: "mexicano",     ...FORMAT_META.mexicano,
      name: tr("fmt_mexicano_name"), tagline: tr("fmt_mexicano_tagline"), desc: tr("fmt_mexicano_desc"),
      tags: [tr("fmt_mexicano_t1"), tr("fmt_mexicano_t2"), tr("fmt_mexicano_t3")] },
    { id: "king_of_hill", ...FORMAT_META.king_of_hill,
      name: tr("fmt_koth_name"), tagline: tr("fmt_koth_tagline"), desc: tr("fmt_koth_desc"),
      tags: [tr("fmt_koth_t1"), tr("fmt_koth_t2"), tr("fmt_koth_t3")] },
    { id: "beat_the_box", ...FORMAT_META.beat_the_box,
      name: tr("fmt_btb_name"), tagline: tr("fmt_btb_tagline"), desc: tr("fmt_btb_desc"),
      tags: [tr("fmt_btb_t1"), tr("fmt_btb_t2"), tr("fmt_btb_t3")] },
  ];
}

const fmtById = (id) => getFormats().find((f) => f.id === id) || getFormats()[0];

function getSections() {
  return [
    { status: "active",   label: tr("trn_sec_active"),   color: "var(--yellow)", limit: null },
    { status: "open",     label: tr("trn_sec_open"),     color: "var(--lime)",   limit: null },
    { status: "finished", label: tr("trn_sec_finished"), color: "var(--mut)",    limit: 5 },
  ];
}

const statusLabel = (s) => ({ open: tr("trn_sec_open"), active: tr("trn_sec_active"), finished: tr("trn_sec_finished") }[s] || s);

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function Tournaments({ groupId, players, profileId, bumpArchive, session, onLogin, isAdmin = false, canCreate = false, membersCanCreate = false }) {
  const [mode, setMode] = useState("list");
  const [activeId, setActiveId] = useState(null);
  if (mode === "create") return <Create groupId={groupId} profileId={profileId} back={() => setMode("list")} open={(id) => { setActiveId(id); setMode("view"); }} />;
  if (mode === "view") return <TournamentView id={activeId} players={players} back={() => setMode("list")} isGroupMember={!!groupId} currentProfileId={profileId} onArchiveChange={bumpArchive} isAdmin={isAdmin} membersCanCreate={membersCanCreate} />;
  return <List groupId={groupId} profileId={profileId} session={session} onLogin={onLogin} canCreate={canCreate} create={() => setMode("create")} open={(id) => { setActiveId(id); setMode("view"); }} />;
}

// ─── TournamentCard ────────────────────────────────────────────────────────────

export function TournamentCard({ trn, color, onClick, onCopy, flush }) {
  const fmt = fmtById(trn.format);
  // Завершённый турнир — считаем победителя и дату прямо на карточке (matches есть в выборке).
  let winner = null;
  if (trn.status === "finished") {
    try {
      if (trn.format === "king_of_hill") {
        const pair = kothChampionPair(trn);
        if (pair) {
          const nm = (pid) => (trn.players || []).find((p) => p.id === pid)?.name || "?";
          winner = `${nm(pair[0])} & ${nm(pair[1])}`;
        }
      } else {
        const tbl = detailedStandings((trn.players || []).map((p) => ({ id: p.id, name: p.name })), (trn.matches || []).filter((m) => m.round_number > 0));
        winner = tbl[0]?.name || null;
      }
    } catch (e) {}
  }
  // Дата+время начала, если заданы; иначе — дата создания (без времени) как запасной вариант.
  const whenIso = trn.starts_at || trn.created_at;
  const dateStr = whenIso ? (() => { try { return new Date(whenIso).toLocaleString(undefined, trn.starts_at ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }); } catch (e) { return null; } })() : null;
  return (
    <div className="tr-card" style={{ marginBottom: flush ? 0 : 8, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={onClick}>
      <Trophy size={20} color={color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{trn.name || fmt.name}</div>
        <div style={{ fontSize: 12, color: "var(--mut)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(trn.players || []).length}/{trn.target_size} {tr("trn_players_label").toLowerCase()} · {trn.points_per_game} {tr("trn_winner_points")} · {fmt.emoji} {fmt.name}</div>
        {(winner || dateStr) && (
          <div style={{ fontSize: 12, marginTop: 3, display: "flex", gap: 10, alignItems: "center", overflow: "hidden" }}>
            {winner && <span style={{ color: "var(--yellow)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>🥇 {winner}</span>}
            {dateStr && <span style={{ color: "var(--mut)", flexShrink: 0 }}>{dateStr}</span>}
          </div>
        )}
      </div>
      <span className="tr-badge" style={{ background: "rgba(255,255,255,.06)", color, flexShrink: 0 }}>{statusLabel(trn.status)}</span>
      {onCopy && (
        <button onClick={(e) => { e.stopPropagation(); onCopy(); }} title={tr("trn_copy")}
          style={{ flexShrink: 0, padding: "7px 9px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--mut)", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Copy size={14} />
        </button>
      )}
    </div>
  );
}

// ─── List ──────────────────────────────────────────────────────────────────────

function List({ groupId, profileId, create, open, session, onLogin, canCreate = false }) {
  const [items, setItems] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [copySrc, setCopySrc] = useState(null);
  useEffect(() => {
    setShowAll(false);
    (groupId ? listTournaments(groupId) : listMyTournaments()).then(setItems).catch(() => setItems([]));
  }, [groupId]);

  const byStatus = {
    active:   (items || []).filter((trn) => trn.status === "active"),
    open:     (items || []).filter((trn) => trn.status === "open"),
    finished: (items || []).filter((trn) => trn.status === "finished"),
  };

  return (
    <div className="tr-root">
      <style>{css}</style>
      {!session ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "color-mix(in srgb, var(--lime) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 30%, transparent)", borderRadius: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 18 }}>🔐</div>
          <div style={{ flex: 1, fontSize: 13, color: "var(--mut)", lineHeight: 1.4 }}>{tr("trn_sign_in_hint")}</div>
          <button className="tr-btn" style={{ padding: "7px 14px", fontSize: 12, flexShrink: 0, borderRadius: 10 }} onClick={onLogin}>{tr("sign_in")}</button>
        </div>
      ) : groupId && canCreate ? (
        <Fab label={tr("trn_create_btn")} icon={<PlusCircle size={20} />} onClick={create} />
      ) : null}
      {items === null && <div className="tr-card" style={{ textAlign: "center", color: "var(--mut)" }}>{tr("loading")}</div>}
      {items !== null && items.length === 0 && (
        <EmptyState className="tr-card" variant="podium"
          text={!session ? tr("trn_empty_guest") : groupId ? tr("trn_empty_session") : tr("solo_tours_empty")} />
      )}
      {items !== null && getSections().filter((sec) => sec.status !== "finished").map((sec) => {
        const list = byStatus[sec.status];
        if (!list.length) return null;
        const hidden = sec.limit && !showAll ? list.length - sec.limit : 0;
        const visible = sec.limit && !showAll ? list.slice(0, sec.limit) : list;
        return (
          <div key={sec.status} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: sec.color, textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>
              {sec.label}
            </div>
            {visible.map((trn) => <TournamentCard key={trn.id} trn={trn} color={sec.color} onClick={() => open(trn.id)} onCopy={groupId ? () => setCopySrc(trn) : null} />)}
            {hidden > 0 && (
              <button className="tr-ghost" style={{ width: "100%", padding: "8px 12px", fontSize: 12, marginTop: 4 }} onClick={() => setShowAll(true)}>
                {tr("trn_show_more_pre")} {hidden} {tr("trn_show_more_suf")}
              </button>
            )}
          </div>
        );
      })}
      {/* Завершённые турниры — только во вкладке «История». */}
      {items !== null && byStatus.finished.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, padding: "10px 12px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)", fontSize: 12.5, color: "var(--mut)" }}>
          <Trophy size={15} style={{ flexShrink: 0, color: "var(--yellow)" }} /> {tr("tours_in_history")}
        </div>
      )}
      {copySrc && (
        <CopyDialog src={copySrc} groupId={groupId} profileId={profileId}
          onClose={() => setCopySrc(null)} onCopied={(id) => { setCopySrc(null); open(id); }} />
      )}
    </div>
  );
}

function CopyDialog({ src, groupId, profileId, onClose, onCopied }) {
  const fmt = fmtById(src.format);
  const [name, setName] = useState(`${src.name || fmt.name} ${tr("trn_copy_suffix")}`);
  const [withPlayers, setWithPlayers] = useState(true);
  const [busy, setBusy] = useState(false);
  const count = (src.players || []).length;
  const go = async () => {
    if (busy) return;
    setBusy(true);
    try { const t = await copyTournament(src.id, groupId, { name, withPlayers, createdBy: profileId }); onCopied(t.id); }
    catch (e) { alert(tr("err_copy_tour")); setBusy(false); }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }} onClick={onClose}>
      <div className="tr-card" style={{ width: "100%", maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{tr("trn_copy_title")}</div>
        <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>{tr("trn_copy_name_label")}</div>
        <input className="tr-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <label style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 16px", cursor: count ? "pointer" : "not-allowed", opacity: count ? 1 : 0.5 }}>
          <input type="checkbox" checked={withPlayers && count > 0} disabled={!count} onChange={(e) => setWithPlayers(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "var(--lime)" }} />
          <span style={{ fontSize: 14 }}>{tr("trn_copy_with_players")} ({count})</span>
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="tr-ghost" style={{ flex: 1, padding: 11 }} onClick={onClose} disabled={busy}>{tr("cancel")}</button>
          <button className="tr-btn" style={{ flex: 1, padding: 11 }} onClick={go} disabled={busy}>{busy ? tr("creating") : tr("trn_copy_btn")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── FormatPicker ──────────────────────────────────────────────────────────────

function FormatPicker({ selected, onSelect }) {
  return (
    <div>
      {getFormats().map((f) => {
        const isSelected = selected === f.id;
        return (
          <div
            key={f.id}
            onClick={() => onSelect(f.id)}
            style={{
              background: isSelected
                ? `color-mix(in srgb, ${f.color} 10%, var(--surface))`
                : "var(--surface)",
              border: `2px solid ${isSelected ? f.color : "var(--line)"}`,
              borderRadius: 16, padding: 16, marginBottom: 10, cursor: "pointer",
              transition: "border-color .12s, background .12s",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: `color-mix(in srgb, ${f.color} 18%, transparent)`,
                border: `1.5px solid color-mix(in srgb, ${f.color} 40%, transparent)`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
              }}>{f.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{f.name}</div>
                <div style={{ fontSize: 12, color: f.id === "americano" ? "var(--lime)" : f.color, fontWeight: 600, marginTop: 1 }}>{f.tagline}</div>
              </div>
              {isSelected && (
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: f.color, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 900,
                  color: f.id === "americano" ? "#0a1612" : "#fff",
                }}>✓</div>
              )}
            </div>
            {/* Description */}
            <div style={{ fontSize: 13, color: "var(--mut)", lineHeight: 1.55, marginBottom: 10 }}>
              {f.desc}
            </div>
            {/* Tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {f.tags.map((tag) => (
                <span key={tag} style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
                  background: `color-mix(in srgb, ${f.color} 14%, transparent)`,
                  color: f.id === "americano" ? "var(--mut)" : f.color,
                  border: `1px solid color-mix(in srgb, ${f.color} 28%, transparent)`,
                }}>{tag}</span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Create (2 шага: format → config) ─────────────────────────────────────────

function Create({ groupId, profileId, back, open }) {
  const [step, setStep] = useState("format");
  const [format, setFormat] = useState(null);
  const [courts, setCourts] = useState(2);
  const [playerCount, setPlayerCount] = useState(8);
  const [kotHChampionRule, setKotHChampionRule] = useState("court_1"); // #4: правило чемпиона KotH
  const [points, setPoints] = useState(32);
  const [day, setDay] = useState(() => nowLocalDT().slice(0, 10));
  const [time, setTime] = useState(() => nowLocalDT().slice(11, 16));
  const date = day ? `${day}T${time || "00:00"}` : "";
  const [place, setPlace] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const fmt = format ? fmtById(format) : null;
  const isKothBtB = format === "king_of_hill" || format === "beat_the_box";
  const isBtb = format === "beat_the_box";     // единственный формат «один корт + очередь»
  const isKoth = format === "king_of_hill";    // «король корта» — по кортам (игроков/4)

  const POINTS_OPTS = [16, 24, 32, 48, 64];
  const COURTS_OPTS = [
    { v: 2, label: tr("trn_court2"), sub: tr("trn_8players") },
    { v: 3, label: tr("trn_court3"), sub: tr("trn_12players") },
    { v: 4, label: tr("trn_court4"), sub: tr("trn_16players") },
    { v: 5, label: tr("trn_court5"), sub: tr("trn_20players") },
    { v: 6, label: tr("trn_court6"), sub: tr("trn_24players") },
  ];
  const KOTH_PLAYER_OPTS = [
    { v: 4,  label: "4",  sub: tr("trn_teams_2") },
    { v: 6,  label: "6",  sub: tr("trn_teams_3") },
    { v: 8,  label: "8",  sub: tr("trn_teams_4") },
    { v: 10, label: "10", sub: tr("trn_teams_5") },
    { v: 12, label: "12", sub: tr("trn_teams_6") },
  ];

  // Автоназвание = формат + размер. Дата/время НЕ дублируются в названии —
  // дата показывается отдельно в карточке турнира.
  React.useEffect(() => {
    if (!format) return;
    try {
      if (isBtb) {
        const teams = playerCount / 2;
        setName(`${fmt.name} · ${teams} ${tr("trn_teams_" + teams).split(" ")[1] || "teams"}`);
      } else {
        const c = COURTS_OPTS.find((o) => o.v === courts);
        if (!c) return;
        setName(`${fmt.name} · ${c.label}`);
      }
    } catch (e) {}
  }, [courts, playerCount, format]);

  const go = async () => {
    setBusy(true);
    try {
      const targetSize = isBtb ? playerCount : courts * 4;
      // Сохраняем КОНКРЕТНЫЙ момент (ISO с таймзоной), чтобы введённое локальное
      // время совпадало с показанным при чтении (без сдвига часовых поясов).
      let startsAtIso = null;
      try { if (date) startsAtIso = new Date(date).toISOString(); } catch (e) { startsAtIso = null; }
      const trn = await createTournament(groupId, { name: name.trim() || null, pointsPerGame: points, targetSize, format, createdBy: profileId, startsAt: startsAtIso, place, kotHChampionRule: isKoth ? kotHChampionRule : undefined });
      open(trn.id);
    } catch (e) { alert(tr("err_create_tour")); setBusy(false); }
  };

  const chip = (active) => ({
    padding: "10px 0", textAlign: "center", borderRadius: 12, cursor: "pointer",
    fontWeight: 600, fontSize: 13, border: "none",
    background: active ? "var(--lime)" : "var(--surface2)",
    color: active ? "var(--lime-fg)" : "var(--ink)",
    outline: active ? "none" : "1px solid var(--line)",
  });

  // ── Step 1: format picker ──────────────────────────────────────────────
  if (step === "format") {
    return (
      <div className="tr-root">
        <style>{css}</style>
        <button className="tr-ghost" style={{ padding: "6px 12px", marginBottom: 14 }} onClick={back}>
          <ArrowLeft size={14} /> {tr("back")}
        </button>
        <div className="tr-d" style={{ fontSize: 22, marginBottom: 4 }}>{tr("trn_pick_format")}</div>
        <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 16, lineHeight: 1.5 }}>
          {tr("trn_pick_format_sub")}
        </div>
        <FormatPicker
          selected={format}
          onSelect={(f) => { setFormat(f); setStep("config"); }}
        />
      </div>
    );
  }

  // ── Step 2: config ────────────────────────────────────────────────────
  return (
    <div className="tr-root">
      <style>{css}</style>
      <button className="tr-ghost" style={{ padding: "6px 12px", marginBottom: 12 }} onClick={() => setStep("format")}>
        <ArrowLeft size={14} /> {tr("trn_change_format")}
      </button>

      <div className="tr-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Selected format badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
          background: `color-mix(in srgb, ${fmt.color} 10%, transparent)`,
          border: `1.5px solid color-mix(in srgb, ${fmt.color} 35%, transparent)`,
          borderRadius: 12,
        }}>
          <span style={{ fontSize: 22 }}>{fmt.emoji}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{fmt.name}</div>
            <div style={{ fontSize: 11, color: fmt.id === "americano" ? "var(--lime)" : fmt.color }}>{fmt.tagline}</div>
          </div>
        </div>

        <div className="tr-d" style={{ fontSize: 18 }}>{tr("trn_settings_title")}</div>

        {/* Courts / Players */}
        {!isBtb ? (
          <div>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{tr("trn_courts_label")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {COURTS_OPTS.map((o) => (
                <button key={o.v} style={chip(courts === o.v)} onClick={() => setCourts(o.v)}>
                  <div>{o.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 400, opacity: .7 }}>{o.sub}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{tr("trn_players_label")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {KOTH_PLAYER_OPTS.map((o) => (
                <button key={o.v} style={chip(playerCount === o.v)} onClick={() => setPlayerCount(o.v)}>
                  <div>{o.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, opacity: .7 }}>{o.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Points */}
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{tr("trn_points_label")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            {POINTS_OPTS.map((p) => (
              <button key={p} style={chip(points === p)} onClick={() => setPoints(p)}>{p}</button>
            ))}
          </div>
        </div>

        {/* Champion rule (King of the Court only) */}
        {isKoth && (
          <div>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{tr("trn_koth_champion_label")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { v: "court_1", label: tr("trn_koth_champion_court1"), sub: tr("trn_koth_champion_court1_sub") },
                { v: "points", label: tr("trn_koth_champion_points"), sub: tr("trn_koth_champion_points_sub") },
              ].map((o) => (
                <button key={o.v} style={chip(kotHChampionRule === o.v)} onClick={() => setKotHChampionRule(o.v)}>
                  <div>{o.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, opacity: .7 }}>{o.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date */}
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>{tr("trn_date_label")}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="date" className="tr-input" style={{ flex: 3 }} value={day} onChange={(e) => setDay(e.target.value)} />
            <input type="time" className="tr-input" style={{ flex: 2 }} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        {/* Place */}
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>{tr("game_where_label")}</div>
          <input className="tr-input" placeholder={tr("court_club_placeholder")} value={place} onChange={(e) => setPlace(e.target.value)} />
        </div>

        {/* Name */}
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>{tr("trn_name_label")}</div>
          <input className="tr-input" placeholder={fmt.name} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {/* Превью: что получится из настроек */}
        {(() => {
          const size = isBtb ? playerCount : courts * 4;
          const detail = format === "americano" ? tr("trn_n_rounds").replace("{n}", String(Math.max(1, size - 1)))
            : format === "beat_the_box" ? tr("trn_matches_dynamic") : tr("trn_rounds_dynamic");
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{fmt.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: "var(--mut)" }}>{tr("trn_preview_label")}: </span>
                <b>{size} {tr("trn_players_label").toLowerCase()}</b>
                <span style={{ color: "var(--mut)" }}> · {detail}</span>
              </div>
            </div>
          );
        })()}

        <button className="tr-btn" style={{ padding: 13 }} disabled={busy} onClick={go}>
          {busy ? tr("trn_creating") : tr("trn_create_go")}
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function groupRounds(matches) {
  const r = {};
  matches.forEach((m) => { (r[m.round_number] = r[m.round_number] || []).push(m); });
  return r;
}

// King of the Court: чемпион зависит от выбранного правила.
//   'court_1' — пара, выигравшая корт №1 в последнем раунде (удержала «королевский» корт);
//   'points'  — пара с наибольшей суммой очков (партнёры фиксированы весь турнир).
// Возвращает пару игроков-победителей [tpId, tpId] или null.
function kothChampionPair(trn) {
  const played = (trn.matches || []).filter((m) => m.round_number > 0 && m.score_a != null);
  if (!played.length) return null;
  const rule = trn.koth_champion_rule || "court_1";
  if (rule === "court_1") {
    const lastRound = Math.max(...played.map((m) => m.round_number));
    const inLast = played.filter((m) => m.round_number === lastRound).sort((a, b) => a.court - b.court);
    const c1 = inLast.find((m) => m.court === 1) || inLast[0];
    if (!c1) return null;
    return (c1.score_a || 0) >= (c1.score_b || 0) ? c1.team_a : c1.team_b;
  }
  const tbl = detailedStandings((trn.players || []).map((p) => ({ id: p.id, name: p.name })), played);
  const topId = tbl[0]?.id;
  if (!topId) return null;
  const anyM = played.find((m) => m.team_a.includes(topId) || m.team_b.includes(topId));
  if (!anyM) return null;
  return anyM.team_a.includes(topId) ? anyM.team_a : anyM.team_b;
}

// Свайп влево по строке участника → удаление (как в Истории/слотах игры).
function SwipeRow({ onDelete, children }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0), startY = useRef(0), active = useRef(false), busy = useRef(false);
  const MAX = 72;
  const down = (e) => { if (busy.current) return; startX.current = e.clientX; startY.current = e.clientY; active.current = true; setDragging(true); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} };
  const move = (e) => {
    if (!active.current) return;
    const dX = e.clientX - startX.current, dY = e.clientY - startY.current;
    if (dx === 0 && Math.abs(dY) > Math.abs(dX)) { active.current = false; setDragging(false); return; }
    setDx(Math.max(-MAX, Math.min(0, dX)));
  };
  const up = async () => {
    if (!active.current) return; active.current = false; setDragging(false);
    if (dx <= -MAX * 0.55) { setDx(-MAX); busy.current = true; try { await onDelete(); } finally { busy.current = false; } setDx(0); }
    else setDx(0);
  };
  return (
    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "var(--coral)" }}>
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: MAX, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <Trash2 size={16} />
      </div>
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? "none" : "transform .22s ease", touchAction: "pan-y", background: "var(--surface)" }}>
        {children}
      </div>
    </div>
  );
}

function AddPlayer({ players, existing, onAdd, disabled }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const existingIds = (existing || []).filter((p) => p.profile_id).map((p) => p.profile_id);
  const available = (players || []).filter((p) => !existingIds.includes(p.id));
  const matches = q.trim()
    ? available.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];
  const suggestions = available.slice(0, 10);
  const addingRef = useRef(false);
  const add = async (entry) => {
    if (addingRef.current) return;   // защита от двойного тапа → дубль игрока
    addingRef.current = true;
    setBusy(true);
    try { await onAdd(entry); setQ(""); } finally { setBusy(false); addingRef.current = false; }
  };

  if (disabled) return <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 10 }}>{tr("trn_max_players")}</div>;
  return (
    <div style={{ marginTop: 10 }}>
      <input className="tr-input" placeholder={tr("trn_search_placeholder")} value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim() ? (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {matches.map((p) => (
            <button key={p.id} className="tr-ghost" disabled={busy} style={{ padding: "8px 10px", textAlign: "left" }}
              onClick={() => add({ profileId: p.id, name: p.name })}>{p.name}</button>
          ))}
          <button className="tr-btn" disabled={busy} style={{ padding: "8px 10px", textAlign: "left" }}
            onClick={() => add({ name: q.trim() })}>{tr("trn_guest_add")}{q.trim()}</button>
          <div style={{ fontSize: 11, color: "var(--mut)", lineHeight: 1.4, padding: "2px 2px" }}>{tr("add_guest_league_hint")}</div>
        </div>
      ) : (
        suggestions.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 6 }}>{tr("trn_friends_hint")}</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", WebkitOverflowScrolling: "touch", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 3%,#000 97%,transparent)", maskImage: "linear-gradient(90deg,transparent,#000 3%,#000 97%,transparent)" }}>
              {suggestions.map((p) => (
                <button key={p.id} className="tr-ghost" disabled={busy} onClick={() => add({ profileId: p.id, name: p.name })}
                  style={{ flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 7, padding: "6px 12px 6px 6px", borderRadius: 999, fontSize: 13 }}>
                  <Avatar name={p.name} url={undefined} id={p.id} size={22} /> {p.name}
                </button>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ─── TournamentView ────────────────────────────────────────────────────────────

export function TournamentView({ id, players, back, readOnly = false, initialT = null, reloadFn = null, isGroupMember = false, currentProfileId = null, spectatorMode = false, onArchiveChange = null, isAdmin = false, membersCanCreate = false }) {
  const hasInitRef = useRef(!!initialT);
  const [trnData, setTrnData] = useState(initialT ? { ...initialT, matches: initialT.matches || [], players: initialT.players || [] } : null);
  const [toast, setToast] = useState("");
  const [cur, setCur] = useState(1);
  const [addingRound, setAddingRound] = useState(false);
  const [pinShown, setPinShown] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinMsg, setPinMsg] = useState(""); // #1: сообщение о неверном PIN — отдельно от toast (кнопки «Ссылка»)
  const [unlocked, setUnlocked] = useState(() => { try { return !!localStorage.getItem("pp_scorepin_" + id); } catch (e) { return false; } });
  const [openCourts, setOpenCourts] = useState({}); // {matchId: true} — раскрытые сыгранные корты
  const initRef = useRef(false);
  const roundRef = useRef(false);
  const startingRef = useRef(false);
  const [burst, setBurst] = useState(0);
  const firedRef = useRef(false);
  useEffect(() => {
    if (trnData && trnData.status === "finished" && !firedRef.current) { firedRef.current = true; setBurst((b) => b + 1); }
  }, [trnData && trnData.status]);

  const load = useCallback(async () => {
    try {
      const data = reloadFn ? await reloadFn() : await getTournament(id);
      setTrnData({ ...data, matches: data.matches || [], players: data.players || [] });
    } catch (e) { if (!hasInitRef.current) setTrnData(false); }
  }, [id, reloadFn]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`t:${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${id}` }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [id, load]);

  useEffect(() => {
    if (!spectatorMode || !reloadFn) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [spectatorMode, load, reloadFn]);

  const isKothBtB = trnData ? (trnData.format === "king_of_hill" || trnData.format === "beat_the_box") : false;
  const isBtb = trnData?.format === "beat_the_box";     // «коробки»: один корт + очередь
  const isKoth = trnData?.format === "king_of_hill";    // «король корта»: лесенка кортов
  const isMexicano = trnData?.format === "mexicano";

  const displayMatches = trnData ? (isKothBtB ? trnData.matches.filter((m) => m.round_number > 0) : trnData.matches) : [];

  useEffect(() => {
    if (!trnData || trnData.status === "open" || initRef.current) return;
    const rmap = groupRounds(displayMatches);
    const nums = Object.keys(rmap).map(Number).sort((a, b) => a - b);
    const firstUnplayed = nums.find((n) => rmap[n].some((m) => m.score_a == null));
    setCur(firstUnplayed || nums[nums.length - 1] || 1);
    initRef.current = true;
  }, [trnData]);

  if (trnData === null) return <div className="tr-root"><style>{css}</style><div className="tr-card" style={{ textAlign: "center", color: "var(--mut)" }}>{tr("loading")}</div></div>;
  if (trnData === false) return <div className="tr-root"><style>{css}</style><div className="tr-card" style={{ color: "var(--coral)" }}>{tr("trn_loading_fail")}</div></div>;

  const fmt = fmtById(trnData.format);
  const amCreator = !!(currentProfileId && trnData.created_by && trnData.created_by === currentProfileId);
  // #3: имя создателя турнира (для понимания, кто может вводить счёт). Резолвим по составу лиги.
  const creatorName = trnData.created_by ? ((players || []).find((p) => p.id === trnData.created_by)?.name || null) : null;
  const nameOf = (tpId) => trnData.players.find((p) => p.id === tpId)?.name || "?";
  const _dogAv = (pid) => pid ? dogAvatar(pid) : null;
  const avatarOfTp = (tpId) => {
    const tp = trnData.players.find((p) => p.id === tpId);
    if (!tp) return null;
    const gp = (players || []).find((gp) => gp.id === tp.profile_id);
    return gp?.avatar_url || (tp.profile_id ? _dogAv(tp.profile_id) : null);
  };

  const table = detailedStandings(trnData.players.map((p) => ({ id: p.id, name: p.name })), trnData.matches.filter((m) => m.round_number > 0));
  // Победитель финального экрана: для KotH — пара по выбранному правилу, иначе — лидер таблицы.
  const kothPair = isKoth && trnData.status === "finished" ? kothChampionPair(trnData) : null;
  const champ = kothPair
    ? (() => {
        const rows = kothPair.map((pid) => table.find((r) => r.id === pid)).filter(Boolean);
        return {
          name: `${nameOf(kothPair[0])} & ${nameOf(kothPair[1])}`,
          points: rows.reduce((s, r) => s + (r.points || 0), 0),
          delta: rows.reduce((s, r) => s + (r.delta || 0), 0),
        };
      })()
    : table[0];
  const done = allMatchesPlayed(displayMatches);
  const rmap = groupRounds(displayMatches);
  const roundNums = Object.keys(rmap).map(Number).sort((a, b) => a - b);
  const N = roundNums.length;
  const curMatches = (rmap[cur] || []).sort((a, b) => a.court - b.court);
  const curComplete = curMatches.length > 0 && curMatches.every((m) => m.score_a != null);
  const isLastRound = cur === N;
  // #3: счёт в раунде можно вводить только когда ВСЕ предыдущие раунды полностью заполнены.
  // Заглядывать вперёд (просмотр пар) можно — но не вводить счёт «через голову».
  const priorComplete = roundNums.filter((n) => n < cur).every((n) => (rmap[n] || []).every((m) => m.score_a != null));

  // Beat the Box queue (в KotH очереди нет — все пары играют каждый раунд)
  let kotHQueue = [];
  if (isBtb && trnData.status !== "open") {
    const allTeams = getAllKotHTeams(trnData.matches);
    const onCourtKeys = new Set(curMatches.flatMap((m) => [
      [...m.team_a].sort().join(","),
      [...m.team_b].sort().join(","),
    ]));
    const lastPlayed = {};
    allTeams.forEach((tm) => { lastPlayed[[...tm].sort().join(",")] = 0; });
    trnData.matches.filter((m) => m.round_number > 0).forEach((m) => {
      const a = [...m.team_a].sort().join(",");
      const b = [...m.team_b].sort().join(",");
      lastPlayed[a] = Math.max(lastPlayed[a] || 0, m.round_number);
      lastPlayed[b] = Math.max(lastPlayed[b] || 0, m.round_number);
    });
    kotHQueue = allTeams
      .filter((tm) => !onCourtKeys.has([...tm].sort().join(",")))
      .sort((a, b) => (lastPlayed[[...a].sort().join(",")] || 0) - (lastPlayed[[...b].sort().join(",")] || 0));
  }

  const canStart = isBtb
    ? trnData.players.length >= 4 && trnData.players.length % 2 === 0
    : trnData.players.length >= 4 && trnData.players.length % 4 === 0;
  const startHint = isBtb
    ? (trnData.players.length % 2 !== 0 ? tr("trn_need_even") : null)
    : (trnData.players.length % 4 !== 0 ? tr("trn_need_mult4") : null);

  const addMexicanoRound = async () => {
    if (roundRef.current) return; roundRef.current = true;
    setAddingRound(true);
    try { await generateMexicanoRound(trnData.id, trnData.players, trnData.matches); await load(); setCur(N + 1); }
    catch (e) { alert(e.message || tr("err_create_round")); }
    finally { setAddingRound(false); roundRef.current = false; }
  };

  const addKotHMatch = async () => {
    if (roundRef.current) return; roundRef.current = true;
    setAddingRound(true);
    try { await generateKotHRound(trnData.id, trnData.matches); await load(); setCur(N + 1); }
    catch (e) { alert(e.message || tr("err_create_match")); }
    finally { setAddingRound(false); roundRef.current = false; }
  };

  const addKotHLadderRound = async () => {
    if (roundRef.current) return; roundRef.current = true;
    setAddingRound(true);
    try { await generateKotHLadderRound(trnData.id, trnData.matches); await load(); setCur(N + 1); }
    catch (e) { alert(e.message || tr("err_create_round")); }
    finally { setAddingRound(false); roundRef.current = false; }
  };

  const share = async () => {
    const url = tournamentLink(trnData.invite_code);
    const text = `${tr("trn_share_text")}${trnData.name ? ` «${trnData.name}»` : ""}: ${url} (${tr("code_label")} ${trnData.invite_code})`;
    try { if (navigator.share) { await navigator.share({ title: tr("tab_tournaments"), text, url }); return; } } catch (e) {}
    try { await navigator.clipboard.writeText(text); setToast(tr("copied")); setTimeout(() => setToast(""), 1500); } catch (e) {}
  };
  const start = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try { await startTournament(trnData.id, trnData.players, trnData.format); await load(); }
    catch (e) { alert(e.message || tr("err_start_tour")); }
    finally { startingRef.current = false; }
  };
  const saveScore = async (matchId, a, b) => {
    let pin = null; try { pin = localStorage.getItem("pp_scorepin_" + id); } catch (e) {}
    await submitMatchScore(matchId, a, b, pin || ""); await load();
  };
  const genPin = async () => {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    try { await setScorePin(trnData.id, pin); setPinShown(pin); } catch (e) { alert(e.message || tr("err_generic")); }
  };
  const unlockPin = async () => {
    const v = pinInput.trim();
    setPinMsg("");
    const ok = await checkScorePin(trnData.id, v).catch(() => false);
    // Успех: карточка сама переключается на «Ввод счёта разблокирован» (setUnlocked).
    // Ошибку показываем ОТДЕЛЬНОЙ строкой под полем, а не в toast (иначе текст лез в кнопку «Ссылка»).
    if (ok) { try { localStorage.setItem("pp_scorepin_" + id, v); } catch (e) {} setUnlocked(true); }
    else { setPinMsg(tr("trn_score_pin_wrong")); setTimeout(() => setPinMsg(""), 2500); }
  };

  const roundLabel = isBtb
    ? `${tr("trn_match_label")} ${cur}`
    : `${tr("trn_round_label")} ${cur}`;
  const roundSub = isBtb
    ? null
    : isMexicano ? ` · ${fmt.name}` : ` / ${N}`;

  const defenderLabel = trnData.format === "king_of_hill" ? tr("trn_defender_koth") : tr("trn_defender_btb");

  return (
    <div className="tr-root">
      <style>{css}</style>
      {back && (
        <button className="tr-ghost" style={{ padding: "6px 12px", marginBottom: 12 }} onClick={back}>
          <ArrowLeft size={14} /> {tr("trn_to_list")}
        </button>
      )}

      {/* Header */}
      <div className="tr-card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="tr-d" style={{ fontSize: 20 }}>{trnData.name || fmt.name}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="tr-ghost" style={{ padding: 8 }} onClick={load}><RefreshCw size={15} /></button>
            {!readOnly && (
              <button className="tr-btn" style={{ padding: "8px 12px", display: "flex", gap: 6, alignItems: "center" }} onClick={share}>
                <Share2 size={14} /> {toast || tr("share_btn")}
              </button>
            )}
            {isGroupMember && (
              <button className="tr-ghost" style={{ padding: 8, color: "var(--coral)", border: "1px solid rgba(255,106,82,.3)" }} title={tr("delete_btn")}
                onClick={async () => {
                  if (!confirm(tr("trn_delete_confirm"))) return;
                  try { await deleteTournament(id); onArchiveChange?.(); back?.(); } catch (e) { alert(tr("err_delete")); }
                }}>
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 2 }}>
          {trnData.players.length}/{trnData.target_size} {tr("trn_players_label").toLowerCase()} · {trnData.points_per_game} {tr("trn_winner_points")} · {fmt.emoji} {fmt.name} · {statusLabel(trnData.status)}
        </div>
        {creatorName && (
          <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 4 }}>
            {tr("created_by_label")}: <span style={{ color: "var(--ink)", fontWeight: 600 }}>{creatorName}</span>
          </div>
        )}
        {(trnData.starts_at || trnData.place) && (
          <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {trnData.starts_at && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} />{(() => { try { return new Date(trnData.starts_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } })()}</span>}
            {trnData.place && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} />{trnData.place}</span>}
          </div>
        )}
      </div>

      {trnData.status === "active" && !readOnly && (
        <div className="tr-card" style={{ marginBottom: 12 }}>
          {isAdmin ? (
            <>
              <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{tr("trn_score_access")}</div>
              {pinShown && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div className="tr-codebox" style={{ flex: 1 }}>{pinShown}</div>
                  <button className="tr-ghost" style={{ padding: "10px 12px" }} onClick={() => { try { navigator.clipboard.writeText(pinShown); } catch (e) {} setToast(tr("copied")); setTimeout(() => setToast(""), 1500); }}><Copy size={15} /></button>
                </div>
              )}
              <button className="tr-ghost" style={{ width: "100%", padding: 10 }} onClick={genPin}>{pinShown ? tr("trn_score_pin_regen") : tr("trn_score_pin_share")}</button>
            </>
          ) : (unlocked || (amCreator && membersCanCreate)) ? (
            <div style={{ fontSize: 13, color: "var(--lime)", display: "flex", alignItems: "center", gap: 6 }}><Check size={14} /> {tr("trn_score_unlocked")}</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{tr("trn_score_pin_prompt")}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="tr-input" inputMode="numeric" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="PIN" style={{ flex: 1 }} />
                <button className="tr-btn" style={{ padding: "8px 16px", width: "auto" }} onClick={unlockPin}>{tr("trn_score_unlock")}</button>
              </div>
              {pinMsg && <div style={{ fontSize: 12, color: "var(--coral)", marginTop: 8 }}>{pinMsg}</div>}
            </>
          )}
        </div>
      )}
      {/* ── LOBBY ─────────────────────────────────────────────────────────── */}
      {trnData.status === "open" && (
        <>
          <div className="tr-card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{tr("trn_participants")} {trnData.players.length}/{trnData.target_size}</div>
            {trnData.players.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 4px", borderBottom: "1px solid var(--line)" }}>
                <Avatar name={p.name} url={avatarOfTp(p.id)} id={p.id} size={34} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: p.profile_id === currentProfileId ? "var(--lime)" : "var(--ink)" }}>{p.name}</span>
                {!readOnly && (
                  <button aria-label={tr("delete_btn")} onClick={async () => { try { await removeTournamentPlayer(p.id); } catch (e) {} load(); }}
                    style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", border: "none", background: "color-mix(in srgb, var(--coral) 16%, transparent)", color: "var(--coral)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
            {!readOnly && (
              <AddPlayer players={players} existing={trnData.players} disabled={trnData.players.length >= trnData.target_size}
                onAdd={async (entry) => { await addTournamentPlayer(trnData.id, entry); load(); }} />
            )}
          </div>
          {!readOnly && (
            <>
              <button className="tr-btn"
                style={{ width: "100%", padding: 14, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                disabled={!canStart} onClick={start}>
                <Play size={18} /> {tr("trn_start_btn")} {fmt.emoji} {fmt.name} ({trnData.players.length})
              </button>
              {startHint && <div style={{ textAlign: "center", color: "var(--coral)", fontSize: 12, marginTop: 8 }}>{startHint}</div>}
              {isMexicano && <div style={{ textAlign: "center", color: "var(--mut)", fontSize: 12, marginTop: 6 }}>{tr("trn_mexicano_hint")}</div>}
              {isKothBtB && <div style={{ textAlign: "center", color: "var(--mut)", fontSize: 12, marginTop: 6 }}>{isKoth ? tr("trn_kingcourt_hint") : tr("trn_koth_hint")}</div>}
            </>
          )}
        </>
      )}

      {/* ── ACTIVE / FINISHED ─────────────────────────────────────────── */}
      {trnData.status !== "open" && (
        <>
          {(!spectatorMode || trnData.status === "finished") && (
            <>
              {/* Round/match navigation — пилюли раундов */}
              <div className="tr-card" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button className="tr-ghost" style={{ padding: 6, flexShrink: 0, opacity: cur > 1 ? 1 : .4 }} disabled={cur <= 1} onClick={() => setCur(cur - 1)}>
                    <ChevronLeft size={16} />
                  </button>
                  <div style={{ flex: 1, display: "flex", gap: 6, overflowX: "auto", padding: "2px 0", scrollbarWidth: "none" }}>
                    {roundNums.map((n) => {
                      const played = (rmap[n] || []).length > 0 && (rmap[n] || []).every((m) => m.score_a != null);
                      const active = n === cur;
                      return (
                        <button key={n} onClick={() => setCur(n)} style={{
                          flexShrink: 0, minWidth: 36, padding: "7px 10px", borderRadius: 10, cursor: "pointer",
                          fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 13, border: "1px solid",
                          borderColor: active ? "var(--lime)" : "var(--line)",
                          background: active ? "var(--lime)" : (played ? "color-mix(in srgb, var(--lime) 12%, transparent)" : "var(--surface2)"),
                          color: active ? "var(--lime-fg)" : (played ? "var(--lime)" : "var(--mut)"),
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                        }}>{n}{played && !active && <Check size={12} />}</button>
                      );
                    })}
                  </div>
                  <button className="tr-ghost" style={{ padding: 6, flexShrink: 0, opacity: cur < N ? 1 : .4 }} disabled={cur >= N} onClick={() => setCur(cur + 1)}>
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="tr-d" style={{ fontSize: 16, marginTop: 8, textAlign: "center" }}>
                  {roundLabel}
                  {roundSub && <span style={{ color: "var(--mut)", fontSize: 13 }}>{roundSub}</span>}
                </div>
              </div>

              {/* Role labels for Beat the Box (защитник/претендент) */}
              {isBtb && curMatches.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px 8px", fontSize: 12, fontWeight: 700 }}>
                  <span style={{ color: fmt.color }}>{defenderLabel}</span>
                  <span style={{ color: "var(--mut)" }}>{tr("trn_challenger")}</span>
                </div>
              )}

              {/* Courts for current round — сыгранные сворачиваются в компактную строку */}
              {curMatches.map((m) => {
                const scored = m.score_a != null && m.score_b != null;
                const collapsed = scored && !openCourts[m.id];
                if (collapsed) {
                  const aWin = m.score_a > m.score_b, bWin = m.score_b > m.score_a;
                  const courtLbl = isBtb ? null : (trnData.court_names?.[String(m.court)] || (tr("trn_court1").replace("1", String(m.court))));
                  return (
                    <div key={m.id} className="tr-card" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 12px" }}
                      onClick={() => setOpenCourts((o) => ({ ...o, [m.id]: true }))}>
                      {courtLbl && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--mut)", flexShrink: 0, textTransform: "uppercase" }}>{courtLbl}</span>}
                      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                        <span style={{ flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: aWin ? "var(--lime)" : "var(--ink)", fontWeight: aWin ? 700 : 500 }}>{nameOf(m.team_a[0])} & {nameOf(m.team_a[1])}</span>
                        <span style={{ fontFamily: "'Anton',sans-serif", fontSize: 15, flexShrink: 0 }}><span style={{ color: aWin ? "var(--lime)" : "var(--ink)" }}>{m.score_a}</span><span style={{ color: "var(--mut)" }}>:</span><span style={{ color: bWin ? "var(--lime)" : "var(--ink)" }}>{m.score_b}</span></span>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: bWin ? "var(--lime)" : "var(--ink)", fontWeight: bWin ? 700 : 500 }}>{nameOf(m.team_b[0])} & {nameOf(m.team_b[1])}</span>
                      </div>
                      <ChevronDown size={15} style={{ color: "var(--mut)", flexShrink: 0 }} />
                    </div>
                  );
                }
                return (
                  <div key={m.id}>
                    <CourtView courtNumber={isBtb ? null : m.court} points={trnData.points_per_game}
                      courtName={trnData.court_names ? trnData.court_names[String(m.court)] : undefined}
                      onRenameCourt={(!readOnly && !isBtb) ? (name) => setCourtName(trnData.id, m.court, name).then(load).catch(() => {}) : undefined}
                      teamA={[nameOf(m.team_a[0]), nameOf(m.team_a[1])]}
                      teamB={[nameOf(m.team_b[0]), nameOf(m.team_b[1])]}
                      teamAvatarsA={[avatarOfTp(m.team_a[0]), avatarOfTp(m.team_a[1])]}
                      teamAvatarsB={[avatarOfTp(m.team_b[0]), avatarOfTp(m.team_b[1])]}
                      scoreA={m.score_a} scoreB={m.score_b}
                      editable={!readOnly && (unlocked || isAdmin || (amCreator && membersCanCreate)) && trnData.status !== "finished" && priorComplete}
                      onSave={(a, b) => saveScore(m.id, a, b)} />
                    {scored && (
                      <button className="tr-ghost" style={{ width: "100%", padding: "6px 0", marginTop: -6, marginBottom: 10, fontSize: 12, color: "var(--mut)", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                        onClick={() => setOpenCourts((o) => ({ ...o, [m.id]: false }))}>
                        <ChevronUp size={13} /> {tr("trn_collapse")}
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Beat the Box queue */}
              {isBtb && kotHQueue.length > 0 && (
                <div className="tr-card" style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--mut)", fontWeight: 700, letterSpacing: .5, marginBottom: 8 }}>{tr("trn_queue_label")}</div>
                  {kotHQueue.map((team, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 10, alignItems: "center",
                      padding: "7px 0",
                      borderBottom: i < kotHQueue.length - 1 ? "1px solid var(--line)" : "none",
                    }}>
                      <span style={{ color: "var(--mut)", fontSize: 13, minWidth: 18 }}>{i + 1}.</span>
                      <span style={{ fontSize: 14 }}>{team.map((pid) => nameOf(pid)).join(" & ")}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Score hint / lock (#3: раунд заблокирован, пока не заполнены предыдущие) */}
              {!priorComplete ? (
                <div style={{ textAlign: "center", color: "var(--yellow)", fontSize: 12, marginBottom: 12 }}>
                  {tr("trn_round_locked")}
                </div>
              ) : !curComplete ? (
                <div style={{ textAlign: "center", color: "var(--mut)", fontSize: 12, marginBottom: 12 }}>
                  {isBtb ? tr("trn_enter_score") : tr("trn_enter_all_scores")}
                </div>
              ) : null}

              {/* Mexicano: generate next round */}
              {!readOnly && isMexicano && curComplete && isLastRound && trnData.status !== "finished" && (
                <button className="tr-btn" style={{ width: "100%", padding: 12, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  disabled={addingRound} onClick={addMexicanoRound}>
                  <Plus size={16} /> {addingRound ? tr("trn_drawing") : tr("trn_next_round_mex")}
                </button>
              )}

              {/* Beat the Box: next match */}
              {!readOnly && isBtb && curComplete && isLastRound && trnData.status !== "finished" && (
                <button className="tr-btn" style={{ width: "100%", padding: 12, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  disabled={addingRound} onClick={addKotHMatch}>
                  <Plus size={16} /> {addingRound ? tr("trn_drawing") : `${tr("trn_next_match")} (${defenderLabel})`}
                </button>
              )}

              {/* King of the Court: next round (лесенка кортов) */}
              {!readOnly && isKoth && curComplete && isLastRound && trnData.status !== "finished" && (
                <button className="tr-btn" style={{ width: "100%", padding: 12, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  disabled={addingRound} onClick={addKotHLadderRound}>
                  <Plus size={16} /> {addingRound ? tr("trn_drawing") : tr("trn_next_round")}
                </button>
              )}

              {/* Finish tournament */}
              {!readOnly && trnData.status !== "finished" && (
                ((isMexicano || isKothBtB) && curComplete && isLastRound) || (!isMexicano && !isKothBtB && done)
              ) && (
                <button className="tr-ghost" style={{ width: "100%", padding: 12, marginBottom: 12, color: "var(--mut)" }}
                  onClick={async () => { await finishTournament(trnData.id); load(); }}>
                  {tr("trn_finish_tournament")}
                </button>
              )}
            </>
          )}

          {/* Standings table */}
          <div className="tr-card" style={{ overflow: "hidden" }}>
            <div className="tr-d" style={{ fontSize: 15, marginBottom: 10 }}>{done ? tr("trn_final_table") : tr("trn_table")}</div>
            {trnData.status === "finished" && champ && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                {/* Победитель — золотой баннер с медальоном */}
                <div onClick={() => setBurst((b) => b + 1)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 16, cursor: "pointer", background: "linear-gradient(135deg,#caa02e 0%,#f7e08b 46%,#b8891c 100%)", boxShadow: "0 8px 22px -6px rgba(180,140,20,.55)" }}>
                  <div style={{ flexShrink: 0, width: 58, height: 58, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #fff4c2, #e8b93a 55%, #a9791a)", border: "3px solid #fff2b0", boxShadow: "0 3px 8px rgba(0,0,0,.3), inset 0 1px 3px rgba(255,255,255,.6)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Anton',sans-serif", fontSize: 27, color: "#7a5410" }}>1</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "#7a5410", textTransform: "uppercase" }}>{isKoth ? tr("trn_koth_champion") : tr("trn_winner")}</div>
                    <div style={{ fontWeight: 800, fontSize: 21, color: "#fff", lineHeight: 1.12, textShadow: "0 1px 3px rgba(120,80,0,.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{champ.name}</div>
                    {isKoth && <div style={{ fontSize: 10, color: "#7a5410", marginTop: 1, fontWeight: 600 }}>{(trnData.koth_champion_rule || "court_1") === "points" ? tr("trn_koth_champion_points") : tr("trn_koth_champion_court1")}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 25, color: "#fff", lineHeight: 1, textShadow: "0 1px 2px rgba(120,80,0,.4)" }}>{champ.points}<span style={{ fontSize: 12, color: "#7a5410", fontFamily: "'Outfit',sans-serif", fontWeight: 700 }}> {tr("trn_winner_points")}</span></div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginTop: 3 }}>{champ.delta > 0 ? "+" : ""}{champ.delta} <span style={{ fontSize: 10, color: "#7a5410", fontWeight: 700 }}>{tr("trn_diff")}</span></div>
                  </div>
                </div>
                {/* Серебро + бронза */}
                {!isKoth && (table[1] || table[2]) && (
                  <div style={{ display: "flex", gap: 10 }}>
                    {[1, 2].filter((i) => table[i]).map((i) => {
                      const meta = i === 1
                        ? { grad: "linear-gradient(135deg,#8f989e,#e6ebee 50%,#aab2b8)", ink: "#3a4247", rank: 2 }
                        : { grad: "linear-gradient(135deg,#9c5f2c,#d9a06a 50%,#8a4f22)", ink: "#40260f", rank: 3 };
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 13, background: meta.grad, boxShadow: "0 4px 12px -4px rgba(0,0,0,.4)", minWidth: 0 }}>
                          <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,.35)", border: "1.5px solid rgba(255,255,255,.65)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Anton',sans-serif", fontSize: 15, color: meta.ink }}>{meta.rank}</span>
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: meta.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{table[i].name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {trnData.status === "finished" && <Confetti burst={burst} />}
            <StandingsTable rows={table} highlightId={(trnData.players || []).find((p) => p.profile_id === currentProfileId)?.id} avatarOf={(row) => ({ url: avatarOfTp(row.id) })} />
          </div>
        </>
      )}
    </div>
  );
}
