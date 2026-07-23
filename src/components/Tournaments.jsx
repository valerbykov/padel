// components/Tournaments.jsx
// Турниры: Американо, Мексикано, King of the Hill, Beat the Box.
// Создание (2 шага: FormatPicker → конфиг), лобби, раунды, итоги.
import React, { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import { supabase } from "../lib/supabase";
import { createPortal } from "react-dom";
import {
  listTournaments, getTournament, addTournamentPlayer, removeTournamentPlayer, combineIncompletePairs,
  startTournament, submitMatchScore, finishTournament, tournamentLink, deleteTournament, listMyTournaments, copyTournament,
  generateMexicanoRound, generateKotHRound, generateKotHLadderRound, setCourtName, setScorePin, checkScorePin,
  getTournamentFee, getFeePayments, setTournamentFee, toggleFeePaid, remindFeeDebtors,
} from "../lib/tournamentApi";
import { detailedStandings, allMatchesPlayed, pairStandings } from "../lib/americano";
import { playerAvatar } from "../lib/avatar";
import Fab from "./Fab";
import { CardSkeleton } from "./Skeleton";
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
import { groupPairs, nextPairNo, allPaired } from "../lib/pairs";
import Avatar from "./Avatar";
import OpenBall from "./OpenBall";
import FeesCard from "./FeesCard";
import EmptyState from "./EmptyState";
import { formatMoney } from "../lib/money";
import { defaultCurrency } from "../lib/region";
import { Trophy, Copy, Play, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Share2, Trash2, Plus, Check, Calendar, MapPin } from "lucide-react";
import { t as tr , dateLocale, isDeletedPlayer} from "../lib/i18n";
import DateTimePicker from "./DateTimePicker";
import { EventLevelBadge } from "./LevelBadges";
import { registerBack } from "../lib/backstack";
import { confirmDialog, showToast } from "./ui-dialogs";
import BackButton from "./BackButton";
import { useIsWide } from "./wide/wide";
import WideSplit from "./wide/WideSplit";
import EmptyDetail from "./wide/EmptyDetail";
// Мастер создания турнира вынесен в отдельный чанк — грузится только при открытии формы.
const Create = lazy(() => import("./TournamentCreate"));
// ТВ-табло — отдельный чанк, грузится только по клику на 📺 в афише.
const TvBoardLazy = lazy(() => import("./TvBoard"));
// Округляем к сетке 5 минут (00:01 → 00:00): степпер времени шагает по 5 мин.
export const nowLocalDT = () => { const d = new Date(); d.setSeconds(0, 0); d.setMinutes(Math.round(d.getMinutes() / 5) * 5); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

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
/* Афиша-постер (турнир И игра). Раньше жила инлайном внутри JSX афиши турнира —
   из-за этого афиша игры (PadelLeague через trCss) оставалась без стилей. */
/* Постер всегда тёмный (жёсткий градиент) → и в СВЕТЛОЙ теме элементы на нём должны
   быть светлыми-на-тёмном. Переопределяем тему-переменные на тёмную палитру внутри
   постера, иначе var(--ink)/(--surface) в светлой теме темнеют и кнопки (напр. «Ссылка»)
   становятся невидимыми. */
.trp-poster{--ink:#eef3ee;--mut:#9db0a5;--surface:#16291f;--surface2:#1d3327;--line:#2c4436;--lime:#c8ff2d;--lime-fg:#0a1612;border-radius:20px;padding:20px 18px 18px;overflow:hidden;position:relative;background:linear-gradient(160deg,#153a2a 0%,#112a20 55%,#0e2018 100%);border:1px solid #2c4436;margin-bottom:12px;}
.trp-trophy{position:absolute;right:-2px;top:128px;font-size:66px;opacity:.11;transform:rotate(-8deg);pointer-events:none;line-height:1;z-index:0;}
.trp-topbar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;position:relative;z-index:2;}
.trp-eyebrow{color:var(--lime);font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;position:relative;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.trp-title{font-family:'Anton',sans-serif;font-size:26px;line-height:1.02;margin:0 0 12px;color:#fff;position:relative;text-wrap:balance;}
.trp-meta{display:flex;flex-direction:column;gap:9px;position:relative;}
.trp-row{display:flex;align-items:center;gap:10px;font-size:14px;color:#e8f0ea;}
.trp-ic{width:19px;text-align:center;flex-shrink:0;}
.trp-chip{display:inline-flex;align-items:center;gap:5px;background:var(--surface2);border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:12.5px;font-weight:600;}
.trp-chip-fee{background:color-mix(in srgb,var(--lime) 12%,transparent);border-color:color-mix(in srgb,var(--lime) 40%,transparent);color:var(--lime);}
.trp-desc{margin-top:14px;padding:12px 13px;background:rgba(0,0,0,.22);border-radius:13px;font-size:13.5px;line-height:1.5;color:#d4e0d6;position:relative;white-space:pre-wrap;}
.trp-contact{display:flex;align-items:center;gap:10px;margin-top:12px;padding:10px 12px;background:var(--surface);border:1px solid var(--line);border-radius:14px;position:relative;}
.trp-avatar{flex-shrink:0;width:30px;height:30px;border-radius:50%;background:var(--lime);color:#0e2018;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;}
.trp-contact-label{font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--mut);}
.trp-contact-name{font-size:13.5px;font-weight:600;color:var(--ink);}
.trp-actions{display:flex;justify-content:flex-end;gap:6px;position:relative;z-index:2;flex-shrink:0;}
.trp-act{display:flex;align-items:center;gap:6px;padding:8px;border-radius:10px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.15);color:var(--ink);cursor:pointer;font-size:13px;font-weight:600;}
.trp-act:hover{background:rgba(0,0,0,.4);}
`;

// ─── Format metadata (non-translatable) ───────────────────────────────────────
export const FORMAT_META = {
  americano:    { emoji: "🔄", color: "#b8ef28", multiOf: 4 },
  mexicano:     { emoji: "📊", color: "var(--yellow)", multiOf: 4 },
  round_robin:  { emoji: "🔁", color: "#4db8e8", multiOf: 4 },
  king_of_hill: { emoji: "⛰️", color: "#ff9d3f", multiOf: 4 },
  beat_the_box: { emoji: "📦", color: "#ff6a52", multiOf: 2 },
};

export function getFormats() {
  return [
    // category: 'solo' (партнёры меняются, личный зачёт) | 'pair' (фикс-пара, зачёт пары).
    // hidden: не показывать при создании (оставлен для рендера уже созданных турниров).
    { id: "americano",    ...FORMAT_META.americano, category: "solo",
      name: tr("fmt_americano_name"), tagline: tr("fmt_americano_tagline"), desc: tr("fmt_americano_desc"),
      tags: [tr("fmt_americano_t1"), tr("fmt_americano_t2"), tr("fmt_americano_t3")] },
    { id: "mexicano",     ...FORMAT_META.mexicano, category: "solo",
      name: tr("fmt_mexicano_name"), tagline: tr("fmt_mexicano_tagline"), desc: tr("fmt_mexicano_desc"),
      tags: [tr("fmt_mexicano_t1"), tr("fmt_mexicano_t2"), tr("fmt_mexicano_t3")] },
    { id: "round_robin",  ...FORMAT_META.round_robin, category: "pair",
      name: tr("fmt_rr_name"), tagline: tr("fmt_rr_tagline"), desc: tr("fmt_rr_desc"),
      tags: [tr("fmt_rr_t1"), tr("fmt_rr_t2"), tr("fmt_rr_t3")] },
    { id: "king_of_hill", ...FORMAT_META.king_of_hill, category: "pair",
      name: tr("fmt_koth_name"), tagline: tr("fmt_koth_tagline"), desc: tr("fmt_koth_desc"),
      tags: [tr("fmt_koth_t1"), tr("fmt_koth_t2"), tr("fmt_koth_t3")] },
    { id: "beat_the_box", ...FORMAT_META.beat_the_box, category: "pair", hidden: true,
      name: tr("fmt_btb_name"), tagline: tr("fmt_btb_tagline"), desc: tr("fmt_btb_desc"),
      tags: [tr("fmt_btb_t1"), tr("fmt_btb_t2"), tr("fmt_btb_t3")] },
  ];
}

export const fmtById = (id) => getFormats().find((f) => f.id === id) || getFormats()[0];

function getSections() {
  return [
    { status: "active",   label: tr("trn_sec_active"),   color: "var(--yellow)", limit: null },
    { status: "open",     label: tr("trn_sec_open"),     color: "var(--lime)",   limit: null },
    { status: "finished", label: tr("trn_sec_finished"), color: "var(--mut)",    limit: 5 },
  ];
}

const statusLabel = (s) => ({ open: tr("trn_sec_open"), active: tr("trn_sec_active"), finished: tr("trn_sec_finished") }[s] || s);

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function Tournaments({ groupId, players, profileId, bumpArchive, session, onLogin, isAdmin = false, canCreate = false, membersCanCreate = false, openReq = null, onOpenPlayer = null }) {
  const isWide = useIsWide();
  const DRAFT_KEY = `pp_trn_draft_${groupId}`;
  // При смене вкладки Tournaments размонтируется (гейт tab===). Чтобы черновик
  // создания пережил уход/возврат, стартуем сразу в форме, если есть непустой
  // черновик (выбран формат или заполнено поле). Открытие по ссылке (openReq) важнее.
  const [mode, setMode] = useState(() => {
    if (openReq?.id) return "list";
    try {
      const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}");
      return (d.format || d.name || d.place || d.description || d.contactName) ? "create" : "list";
    } catch (e) { return "list"; }
  });
  const [activeId, setActiveId] = useState(null);
  // Открытие конкретного турнира из уведомления (TournamentView сам грузит по id).
  // Эффект ДО ранних return — хуки должны вызываться безусловно.
  const openedReqRef = useRef(0);
  useEffect(() => {
    if (!openReq?.id || openReq.nonce === openedReqRef.current) return;
    openedReqRef.current = openReq.nonce;
    setActiveId(openReq.id); setMode("view");
  }, [openReq]);
  // Явный выход из формы (BackButton) = отмена: чистим черновик, иначе он бы
  // снова затянул нас в форму при следующем открытии вкладки.
  const cancelCreate = () => { try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) {} setMode("list"); };
  if (mode === "create") return <Suspense fallback={<div style={{ minHeight: "60vh" }} />}><Create key={groupId} groupId={groupId} profileId={profileId} players={players} back={cancelCreate} open={(id) => { setActiveId(id); setMode("view"); }} /></Suspense>;
  const detailEl = mode === "view"
    ? <TournamentView key={activeId} id={activeId} players={players} back={() => setMode("list")} isGroupMember={!!groupId} currentProfileId={profileId} onArchiveChange={bumpArchive} isAdmin={isAdmin} membersCanCreate={membersCanCreate} onOpenPlayer={onOpenPlayer} />
    : null;
  if (mode === "view" && !isWide) return detailEl;
  const listEl = <List groupId={groupId} profileId={profileId} players={players} session={session} onLogin={onLogin} canCreate={canCreate} isAdmin={isAdmin} membersCanCreate={membersCanCreate} create={() => setMode("create")} open={(id) => { setActiveId(id); setMode("view"); }} activeId={isWide && mode === "view" ? activeId : null} />;
  if (isWide) return <WideSplit list={listEl} detail={detailEl}
    empty={<EmptyDetail icon="🏆" title={tr("tab_tournaments")} sub={tr("wide_pick_tour")} />} />;
  return listEl;
}

// ─── TournamentHero ────────────────────────────────────────────────────────────
// Активный турнир наверху списка: прогресс раундов, текущий лидер, CTA к счёту.
function TournamentHero({ trn, onOpen, scoreCta = true, active = false }) {
  const ms = (trn.matches || []).filter((m) => m.round_number > 0);
  const total = ms.length;
  const done = ms.filter((m) => m.score_a != null && m.score_b != null).length;
  const rounds = ms.reduce((mx, m) => Math.max(mx, m.round_number || 0), 0);
  let cur = rounds;
  for (let r = 1; r <= rounds; r++) {
    if (ms.some((m) => m.round_number === r && m.score_a == null)) { cur = r; break; }
  }
  let leader = null;
  try {
    const tbl = detailedStandings((trn.players || []).map((p) => ({ id: p.id, name: p.name })), ms);
    if (tbl[0] && tbl[0].played > 0) leader = tbl[0];
  } catch (e) {}
  return (
    <div onClick={onOpen} style={{ position: active ? "relative" : undefined, border: active ? "1.5px solid var(--lime)" : "1.5px solid color-mix(in srgb, var(--yellow) 45%, transparent)", background: "linear-gradient(160deg, color-mix(in srgb, var(--yellow) 9%, var(--surface)), var(--surface))", borderRadius: 18, padding: "14px 14px 13px", marginBottom: 10, cursor: "pointer", boxShadow: active ? "0 0 0 3px color-mix(in srgb, var(--lime) 20%, transparent)" : undefined }}>
      {active && <OpenBall />}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: "var(--yellow)", textTransform: "uppercase" }}>🏆 {tr("trn_hero_now")}</span>
        {rounds > 0 && <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--mut)" }}>{tr("trn_hero_round").replace("{a}", String(cur)).replace("{b}", String(rounds))}</span>}
      </div>
      <div style={{ fontWeight: 700, fontSize: 16, margin: "7px 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trn.name || fmtById(trn.format).name}</div>
      <div style={{ height: 6, borderRadius: 4, background: "var(--surface2)", overflow: "hidden", marginBottom: 8 }}>
        <div style={{ width: `${total ? Math.round((done / total) * 100) : 0}%`, height: "100%", background: "var(--yellow)", transition: "width .3s" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", fontSize: 12, color: "var(--mut)", gap: 8 }}>
        {leader && <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tr("trn_hero_leader")}: <b style={{ color: "var(--ink)" }}>{leader.name}</b> · {leader.points} {tr("trn_hero_pts")}</span>}
        <button onClick={(e) => { e.stopPropagation(); onOpen(); }}
          style={{ marginLeft: "auto", flexShrink: 0, border: "none", borderRadius: 11, padding: "9px 14px", fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 12.5, cursor: "pointer", background: "var(--yellow)", color: "#1c1503" }}>
          {scoreCta ? tr("trn_hero_score") : tr("hero_open")}
        </button>
      </div>
    </div>
  );
}

// ─── TournamentCard ────────────────────────────────────────────────────────────

export function TournamentCard({ trn, color, onClick, onCopy, flush, me = null, onTake = null, takeBusy = false, myDelta = null, placeFor = null, showMeBadge = true, active = false }) {
  const fmt = fmtById(trn.format);
  const mine = !!me && (trn.players || []).some((pl) => pl.profile_id === me);
  // Завершённый турнир — победитель, топ-3 (мини-подиум), моё место и дата.
  let winner = null;
  let top3 = [];
  // Место считаем для фокус-игрока (выбранного в карусели «Истории»), по умолчанию — своё.
  const pf = placeFor || me;
  let myPlace = null;
  const myTp = pf ? (trn.players || []).find((pl) => pl.profile_id === pf) : null;
  if (trn.status === "finished") {
    try {
      if (trn.format === "king_of_hill") {
        const pair = kothChampionPair(trn);
        if (pair) {
          const nm = (pid) => (trn.players || []).find((p) => p.id === pid)?.name || "?";
          winner = `${nm(pair[0])} & ${nm(pair[1])}`;
          top3 = pair.map((pid) => (trn.players || []).find((p) => p.id === pid)).filter(Boolean);
        }
      } else {
        const tbl = detailedStandings((trn.players || []).map((p) => ({ id: p.id, name: p.name })), (trn.matches || []).filter((m) => m.round_number > 0));
        winner = tbl[0]?.name || null;
        top3 = tbl.slice(0, 3).map((row) => (trn.players || []).find((p) => p.id === row.id)).filter(Boolean);
        if (myTp) {
          const idx = tbl.findIndex((row) => row.id === myTp.id);
          if (idx >= 0) myPlace = idx + 1;
        }
      }
    } catch (e) {}
  }
  const avaOf = (p) => p?.profile?.avatar_url || null;
  // Дата+время начала, если заданы; иначе — дата создания (без времени) как запасной вариант.
  const whenIso = trn.starts_at || trn.created_at;
  // У завершённых время старта уже не важно — короткая дата освобождает
  // место победителю в строке итогов.
  const dateStr = whenIso ? (() => { try { return new Date(whenIso).toLocaleString(dateLocale(), trn.starts_at && trn.status !== "finished" ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }); } catch (e) { return null; } })() : null;
  return (
    <div className="tr-card" style={{ position: active ? "relative" : undefined, marginBottom: flush ? 0 : 8, cursor: "pointer",
      border: active ? "1.5px solid var(--lime)" : mine ? "1.5px solid color-mix(in srgb, var(--lime) 60%, transparent)" : undefined,
      background: mine ? "color-mix(in srgb, var(--lime) 8%, transparent)" : undefined,
      boxShadow: active ? "0 0 0 3px color-mix(in srgb, var(--lime) 20%, transparent)" : undefined }} onClick={onClick}>
      {active && <OpenBall />}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Завершённый: мини-подиум из аватарок (чемпион с золотой рамкой) вместо кубка */}
        {trn.status === "finished" && top3.length > 0 ? (
          <div style={{ display: "flex", paddingLeft: 10, flexShrink: 0 }}>
            {top3.map((p, i) => (
              <span key={p.id} style={{ marginLeft: -10, borderRadius: "50%", border: `2px solid ${i === 0 ? "var(--yellow)" : "var(--line)"}`, display: "inline-flex", position: "relative", zIndex: 3 - i }}>
                <Avatar name={p.name} url={avaOf(p)} id={p.id} size={30} />
              </span>
            ))}
          </div>
        ) : (
          <Trophy size={24} color={color} style={{ flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{trn.name || fmt.name}</span>
            {mine && showMeBadge && <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, padding: "2px 7px", borderRadius: 20, background: "color-mix(in srgb, var(--lime) 18%, transparent)", color: "var(--lime)", flexShrink: 0, textTransform: "uppercase" }}>{tr("you_badge")}</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--mut)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(trn.players || []).length}/{trn.target_size} {tr("trn_players_label").toLowerCase()} · {trn.points_per_game} {tr("trn_winner_points")} · {fmt.emoji} {fmt.name}</div>
          {(winner || dateStr || myPlace) && (
            <div style={{ fontSize: 12, marginTop: 3, display: "flex", gap: 10, alignItems: "center", overflow: "hidden" }}>
              {/* Победитель — главный в строке: не сжимается в «Б…»; место
                  фокус-игрока ужимается первым, дата всегда видна. */}
              {winner && <span style={{ color: "var(--yellow)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0, maxWidth: (myPlace && myPlace > 1) || dateStr ? "52%" : "100%" }}>🥇 {winner}</span>}
              {myPlace && myPlace > 1 && (
                <span style={{ color: "var(--mut)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {pf === me
                    ? tr("hist_you_place").replace("{p}", String(myPlace))
                    : tr("hist_place_of").replace("{name}", (myTp?.name || "").split(" ")[0]).replace("{p}", String(myPlace))}
                </span>
              )}
              {dateStr && <span style={{ color: "var(--mut)", flexShrink: 0, marginLeft: "auto" }}>{dateStr}</span>}
            </div>
          )}
        </div>
        {/* Моя суммарная дельта за турнир — вместо статус-бейджа у завершённых */}
        {trn.status === "finished" && myDelta != null ? (
          <span className="tr-badge" style={{ flexShrink: 0, fontWeight: 800,
            background: myDelta > 0 ? "color-mix(in srgb, var(--lime) 15%, transparent)" : myDelta < 0 ? "color-mix(in srgb, var(--coral) 14%, transparent)" : "rgba(255,255,255,.06)",
            color: myDelta > 0 ? "var(--lime)" : myDelta < 0 ? "var(--coral)" : "var(--mut)" }}>
            {myDelta > 0 ? `+${myDelta}` : String(myDelta)}
          </span>
        ) : (
          <span className="tr-badge" style={{ background: "rgba(255,255,255,.06)", color: trn.status === "finished" ? "var(--mut)" : color, flexShrink: 0 }}>{statusLabel(trn.status)}</span>
        )}
        {onCopy && (
          <button onClick={(e) => { e.stopPropagation(); onCopy(); }} title={tr("trn_copy")}
            style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "7px 10px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--mut)", cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontSize: 11.5, fontWeight: 700 }}>
            <Copy size={13} /> {tr("trn_again")}
          </button>
        )}
      </div>
      {/* Лобби: аватары записавшихся всегда видны у открытых турниров; «+» и «Занять»
          — только пока можно записаться (записался → аватарки остаются, без «+»/кнопки). */}
      {trn.status === "open" && (
        <div style={{ display: "flex", alignItems: "center", marginTop: 10 }}>
          <div style={{ display: "flex", paddingLeft: 10 }}>
            {(trn.players || []).slice(0, 6).map((p) => (
              <span key={p.id} style={{ marginLeft: -10, borderRadius: "50%", border: "2px solid var(--line)", display: "inline-flex" }}>
                <Avatar name={p.name} url={avaOf(p)} id={p.id} size={28} />
              </span>
            ))}
            {onTake && (trn.players || []).length < trn.target_size && (
              /* Свободное место: лаймовый «+» вместо тёмной дыры — рифмуется с «Занять» */
              <span style={{ width: 28, height: 28, borderRadius: "50%", border: "1.5px dashed color-mix(in srgb, var(--lime) 45%, var(--line))", background: "color-mix(in srgb, var(--lime) 8%, var(--surface2))", marginLeft: -10, boxSizing: "border-box", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "var(--lime)", lineHeight: 1 }}>+</span>
            )}
          </div>
          <span style={{ fontSize: 11.5, color: "var(--mut)", marginLeft: 8 }}>{(trn.players || []).length}/{trn.target_size}</span>
          {onTake && (
            <button onClick={(e) => { e.stopPropagation(); if (!takeBusy) onTake(); }} disabled={takeBusy}
              style={{ marginLeft: "auto", flexShrink: 0, border: "none", borderRadius: 11, padding: "8px 14px", fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 12.5, cursor: "pointer", background: "var(--lime)", color: "var(--lime-fg)", opacity: takeBusy ? .55 : 1 }}>
              {takeBusy ? "…" : tr("pub_take_slot")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── List ──────────────────────────────────────────────────────────────────────

function List({ groupId, profileId, players = [], create, open, session, onLogin, canCreate = false, isAdmin = false, membersCanCreate = false, activeId = null }) {
  const [items, setItems] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [copySrc, setCopySrc] = useState(null);
  const reload = useCallback(() => {
    (groupId ? listTournaments(groupId) : listMyTournaments()).then(setItems).catch(() => setItems([]));
  }, [groupId]);
  useEffect(() => { setShowAll(false); reload(); }, [reload]);

  const byStatus = {
    active:   (items || []).filter((trn) => trn.status === "active"),
    open:     (items || []).filter((trn) => trn.status === "open"),
    finished: (items || []).filter((trn) => trn.status === "finished"),
  };
  // Активный турнир — hero наверху; остальные активные остаются в секции.
  const heroTrn = byStatus.active[0] || null;
  // «Занять» из карточки лобби: записываю себя тем же путём, что и «Я сам» внутри.
  const canTake = (trn) => !!profileId && (trn.players || []).length < trn.target_size &&
    !(trn.players || []).some((p) => p.profile_id === profileId);
  const [takingId, setTakingId] = useState(null);
  const takeSeat = async (trn) => {
    if (takingId) return;
    setTakingId(trn.id);
    const myName = (players || []).find((p) => p.id === profileId)?.name || tr("guest_default_name");
    try { await addTournamentPlayer(trn.id, { profileId, name: myName }); } catch (e) {}
    try { await reload(); } finally { setTakingId(null); }
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
        <Fab label={tr("trn_create_btn")} icon={<Trophy size={24} />} onClick={create} />
      ) : null}
      {items === null && <CardSkeleton count={4} />}
      {items !== null && items.length === 0 && (
        <EmptyState className="tr-card" variant="podium"
          text={!session ? tr("trn_empty_guest") : groupId ? tr("trn_empty_session") : tr("solo_tours_empty")} />
      )}
      {items !== null && heroTrn && (
        /* CTA «Ввести счёт» — только у тех, кто реально может вводить (свободный
           ввод / админ / создатель при праве участников); остальным — «Открыть». */
        <TournamentHero trn={heroTrn} onOpen={() => open(heroTrn.id)} active={heroTrn.id === activeId}
          scoreCta={!!heroTrn.open_scoring || isAdmin || (membersCanCreate && heroTrn.created_by === profileId)} />
      )}
      {items !== null && getSections().filter((sec) => sec.status !== "finished").map((sec) => {
        const list = sec.status === "active" ? byStatus.active.filter((trn) => trn !== heroTrn) : byStatus[sec.status];
        if (!list.length) return null;
        const hidden = sec.limit && !showAll ? list.length - sec.limit : 0;
        const visible = sec.limit && !showAll ? list.slice(0, sec.limit) : list;
        return (
          <div key={sec.status} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: sec.color, textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>
              {sec.label}
            </div>
            {visible.map((trn) => {
              const canDel = session && groupId && canCreate;
              const card = <TournamentCard trn={trn} color={sec.color} me={profileId} flush={canDel} onClick={() => open(trn.id)} active={trn.id === activeId}
                onCopy={groupId && trn.status === "finished" ? () => setCopySrc(trn) : null}
                onTake={trn.status === "open" && canTake(trn) ? () => takeSeat(trn) : null}
                takeBusy={takingId === trn.id} />;
              return canDel
                ? <div key={trn.id} style={{ marginBottom: 8 }}><SwipeRow onDelete={async () => { if (!(await confirmDialog({ title: tr("trn_delete_confirm"), message: tr("trn_delete_msg"), confirmLabel: tr("delete_btn") }))) return; await deleteTournament(trn.id).catch(() => {}); reload(); }}>{card}</SwipeRow></div>
                : <div key={trn.id}>{card}</div>;
            })}
            {hidden > 0 && (
              <button className="tr-ghost" style={{ width: "100%", padding: "8px 12px", fontSize: 12, marginTop: 4 }} onClick={() => setShowAll(true)}>
                {tr("trn_show_more_pre")} {hidden} {tr("trn_show_more_suf")}
              </button>
            )}
          </div>
        );
      })}
      {items !== null && items.length > 0 && byStatus.active.length === 0 && byStatus.open.length === 0 && (
        <EmptyState className="tr-card" text={tr("tours_no_active")} />
      )}
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

export function CopyDialog({ src, groupId, profileId, onClose, onCopied }) {
  useEffect(() => registerBack(onClose), [onClose]);
  const fmt = fmtById(src.format);
  const [name, setName] = useState(`${src.name || fmt.name} ${tr("trn_copy_suffix")}`);
  const [withPlayers, setWithPlayers] = useState(true);
  const [day, setDay] = useState(() => nowLocalDT().slice(0, 10));
  const [time, setTime] = useState(() => nowLocalDT().slice(11, 16));
  const [place, setPlace] = useState(src.place || "");
  const [busy, setBusy] = useState(false);
  const count = (src.players || []).length;
  const lab = { fontSize: 10.5, fontWeight: 800, color: "var(--mut)", textTransform: "uppercase", letterSpacing: .7, margin: "16px 2px 7px" };
  const go = async () => {
    if (busy) return;
    setBusy(true);
    let startsAtIso = null;
    try { const d = day ? `${day}T${time || "00:00"}` : ""; if (d) startsAtIso = new Date(d).toISOString(); } catch (e) { startsAtIso = null; }
    try { const t = await copyTournament(src.id, groupId, { name, withPlayers, createdBy: profileId, startsAt: startsAtIso, place }); onCopied(t.id); }
    catch (e) { showToast(tr("err_copy_tour")); setBusy(false); }
  };
  // Портал в body: fixed-оверлей внутри анимируемого предка «уезжает» от вьюпорта.
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", fontFamily: "'Outfit',sans-serif" }} onClick={onClose}>
      <div className="tr-card" style={{ width: "100%", maxWidth: 344, padding: "20px 18px 18px", margin: "20px 0" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 38, height: 38, borderRadius: 13, background: "color-mix(in srgb, var(--lime) 15%, transparent)", color: "var(--lime)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid color-mix(in srgb, var(--lime) 30%, transparent)" }}><Copy size={18} /></span>
          <div><div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)" }}>{tr("trn_copy_title")}</div><div style={{ fontSize: 11.5, color: "var(--mut)" }}>{tr("trn_copy_sub")}</div></div>
        </div>
        <div style={lab}>{tr("trn_copy_name_label")}</div>
        <input className="tr-input" style={{ padding: "13px 14px", fontWeight: 600 }} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <DateTimePicker day={day} time={time} onDay={setDay} onTime={setTime} />
        <div style={lab}>{tr("court_club_placeholder")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 13, padding: "0 14px" }}>
          <MapPin size={15} style={{ color: "var(--lime)", flexShrink: 0 }} />
          <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder={tr("court_club_placeholder")} style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--ink)", fontFamily: "'Outfit',sans-serif", fontSize: 15, fontWeight: 600, padding: "13px 0" }} />
        </div>
        <div onClick={() => count && setWithPlayers((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 11, margin: "14px 2px 0", cursor: count ? "pointer" : "not-allowed", opacity: count ? 1 : 0.5 }}>
          <span style={{ width: 44, height: 26, borderRadius: 13, flexShrink: 0, position: "relative", transition: "background .15s",
            background: withPlayers && count > 0 ? "var(--lime)" : "var(--surface2)", border: withPlayers && count > 0 ? "none" : "1px solid var(--line)" }}>
            <span style={{ position: "absolute", top: 3, left: withPlayers && count > 0 ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{tr("trn_copy_with_players")} ({count})</span>
        </div>
        <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
          <button className="tr-ghost" style={{ flex: "0 0 34%", padding: 13 }} onClick={onClose} disabled={busy}>{tr("cancel")}</button>
          <button className="tr-btn" style={{ flex: 1, padding: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }} onClick={go} disabled={busy}><Copy size={15} /> {busy ? tr("creating") : tr("trn_copy_btn")}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── FormatPicker ──────────────────────────────────────────────────────────────

export function FormatPicker({ selected, onSelect }) {
  // Две секции: solo (партнёры меняются) и pair (фикс-пара). Скрытые (beat_the_box)
  // не показываем при создании, но fmtById их ещё резолвит для старых турниров.
  const all = getFormats().filter((f) => !f.hidden);
  const cats = [
    { id: "solo", label: tr("fmt_cat_solo"), sub: tr("fmt_cat_solo_sub"), color: "var(--lime)" },
    { id: "pair", label: tr("fmt_cat_pair"), sub: tr("fmt_cat_pair_sub"), color: "#7fd0ff" },
  ];
  const card = (f) => {
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
  };
  return (
    <div>
      {cats.map((c) => {
        const items = all.filter((f) => (f.category || "solo") === c.id);
        if (!items.length) return null;
        return (
          <div key={c.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 2px 8px" }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: c.color }}>{c.label}</span>
              <span style={{ fontSize: 11.5, color: "var(--mut)" }}>{c.sub}</span>
              <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            {items.map(card)}
          </div>
        );
      })}
    </div>
  );
}

// ─── Create (2 шага: format → config) ─────────────────────────────────────────

// Черновик формы создания турнира — переживает уход со вкладки «Турниры»
// (весь Create размонтируется при переключении табов и терял бы состояние).
// Ключ привязан к лиге (groupId): черновик одной лиги не должен подставляться
// в другую при переключении активной лиги в той же вкладке.
export function loadTrnDraft(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || "{}"); } catch (e) { return {}; }
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
  const isWide = useIsWide();     // десктоп: свайп → hover-кнопка удаления
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0), startY = useRef(0), active = useRef(false), busy = useRef(false), captured = useRef(false), pid = useRef(null);
  const MAX = 72;
  // Захват указателя откладываем до реального горизонтального свайпа: иначе на десктопе
  // setPointerCapture на pointerdown перехватывает click и он не доходит до карточки (мышь «не кликает»).
  const down = (e) => { if (busy.current) return; startX.current = e.clientX; startY.current = e.clientY; active.current = true; captured.current = false; pid.current = e.pointerId; setDragging(true); };
  const move = (e) => {
    if (!active.current) return;
    const dX = e.clientX - startX.current, dY = e.clientY - startY.current;
    if (dx === 0 && Math.abs(dY) > Math.abs(dX)) { active.current = false; setDragging(false); return; }
    if (!captured.current && Math.abs(dX) > 6) { try { e.currentTarget.setPointerCapture(pid.current); } catch (_) {} captured.current = true; }
    // До порога захвата карточку не двигаем: микросдвиг пальца при тапе
    // дёргал transform, и iOS проглатывал click (кнопка «Занять» и т.п.).
    if (captured.current) setDx(Math.max(-MAX, Math.min(0, dX)));
  };
  const up = async () => {
    if (!active.current) return; active.current = false; setDragging(false);
    if (dx <= -MAX * 0.55) { setDx(-MAX); busy.current = true; try { await onDelete(); } finally { busy.current = false; } setDx(0); }
    else setDx(0);
  };
  // Десктоп: свайп → видимая hover-кнопка удаления в углу карточки.
  if (isWide) {
    return (
      <div className="tsr-hover" style={{ position: "relative", marginBottom: 8 }}>
        <style>{`.tsr-hover .tsr-del{opacity:0;transition:opacity .12s}.tsr-hover:hover .tsr-del,.tsr-hover:focus-within .tsr-del{opacity:1}`}</style>
        {children}
        <button className="tsr-del" onClick={(e) => { e.stopPropagation(); onDelete(); }} aria-label={tr("delete_btn")} title={tr("delete_btn")}
          style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--coral)", cursor: "pointer", display: "grid", placeItems: "center", zIndex: 3 }}>
          <Trash2 size={15} />
        </button>
      </div>
    );
  }
  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: dx < 0 ? "var(--coral)" : "transparent" }}>
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

export function AddPlayer({ players, existing, onAdd, disabled, meId = null }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const existingIds = (existing || []).filter((p) => p.profile_id).map((p) => p.profile_id);
  const available = (players || []).filter((p) => !existingIds.includes(p.id) && !isDeletedPlayer(p));
  // «Я сам» — первый чип карусели (пока не записан); остальные — без меня.
  const me = (!!meId && !existingIds.includes(meId)) ? available.find((p) => p.id === meId) : null;
  const matches = q.trim()
    ? available.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];
  const suggestions = available.filter((p) => p.id !== meId).slice(0, 10);
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
        (me || suggestions.length > 0) && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 6 }}>{tr("trn_friends_hint")}</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", WebkitOverflowScrolling: "touch", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 3%,#000 97%,transparent)", maskImage: "linear-gradient(90deg,transparent,#000 3%,#000 97%,transparent)" }}>
              {me && (
                <button className="tr-ghost" disabled={busy} onClick={() => add({ profileId: me.id, name: me.name })}
                  style={{ flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 7, padding: "6px 12px 6px 6px", borderRadius: 999, fontSize: 13, fontWeight: 700, borderColor: "color-mix(in srgb, var(--lime) 45%, transparent)", color: "var(--lime)" }}>
                  <Avatar name={me.name} url={undefined} id={me.id} size={22} /> {tr("pick_me")}
                </button>
              )}
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

// ─── TournamentPoster ──────────────────────────────────────────────────────────
// Афиша: постер со всей инфой турнира (тайтл/дата/место/уровень/взнос/описание/контакт) —
// единый header для ЛЮБОГО статуса турнира. Вынесен из TournamentView, чтобы его же
// мог рендерить публичный /l/CODE (без хуков/состояния TournamentView) — байт-в-байт
// тот же JSX, только источники данных пришли пропами. Экшены (ТВ/шеринг/удаление) —
// опциональные колбэки: не передали — кнопка не рендерится (гостю/паблик-странице нечего
// шарить/удалять).
export function TournamentPoster({ trnData, fmt, readOnly, isKoth, isBtb, isGroupMember, toast, avatarOfTp, onShare, onTv, onDelete }) {
  return (
    <div className="trp-poster">
      <span className="trp-trophy">🏆</span>
      <div className="trp-topbar">
        <div className="trp-eyebrow">🏆 {tr("trn_share_text")}</div>
        <div className="trp-actions">
          {trnData.status === "active" && onTv && (
            <button className="trp-act" onClick={onTv} aria-label="TV">📺</button>
          )}
          {!readOnly && onShare && (
            <button className="trp-act" style={{ padding: "8px 12px" }} onClick={onShare}>
              <Share2 size={14} /> {toast || tr("share_btn")}
            </button>
          )}
          {isGroupMember && onDelete && (
            <button className="trp-act" style={{ color: "var(--coral)", borderColor: "rgba(255,106,82,.4)" }} title={tr("delete_btn")}
              onClick={onDelete}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
      <div className="trp-title">{trnData.name || fmt.name}</div>
      <div className="trp-meta">
        {trnData.starts_at && (
          <div className="trp-row"><span className="trp-ic">🗓️</span>
            <span>{(() => { try { const s = new Date(trnData.starts_at).toLocaleString(dateLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); const e = trnData.ends_at ? new Date(trnData.ends_at).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" }) : null; return e ? `${s} – ${e}` : s; } catch (e) { return ""; } })()}</span>
          </div>
        )}
        {trnData.place && (
          <div className="trp-row"><span className="trp-ic">📍</span><span>{trnData.place}</span></div>
        )}
        {trnData.level && (
          <div className="trp-row"><span className="trp-ic">🎖️</span><EventLevelBadge level={trnData.level} compact /></div>
        )}
        <div className="trp-row"><span className="trp-ic">{fmt.emoji}</span><span>{fmt.name} · {trnData.points_per_game} {tr("trn_winner_points")}</span></div>
        {isKoth && (
          <div className="trp-row"><span className="trp-ic">🏆</span>
            <span>{tr("trn_koth_rule_prefix")} {(trnData.koth_champion_rule || "court_1") === "points" ? tr("trn_koth_champion_points") : tr("trn_koth_champion_court1")}</span>
          </div>
        )}
        {trnData.fee_per_player > 0 && (
          <div className="trp-row"><span className="trp-ic">💸</span><span className="trp-chip trp-chip-fee">{formatMoney(trnData.fee_per_player, trnData.fee_currency)}</span></div>
        )}
        <div className="trp-row"><span className="trp-ic">👥</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {(trnData.players || []).length > 0 && (
              <span style={{ display: "inline-flex", flexShrink: 0 }}>
                {trnData.players.slice(0, 5).map((p, k) => (
                  <img key={p.id} src={playerAvatar(avatarOfTp(p.id), p.profile_id || p.name, p.name)} alt=""
                    style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", marginLeft: k ? -8 : 0, boxShadow: "0 0 0 2px #112a20", background: "var(--surface2)" }} />
                ))}
                {trnData.players.length > 5 && <span style={{ marginLeft: -8, width: 24, height: 24, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--line)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--mut)", boxShadow: "0 0 0 2px #112a20" }}>+{trnData.players.length - 5}</span>}
              </span>
            )}
            <span>{trnData.players.length}/{trnData.target_size} {tr("trn_players_label").toLowerCase()}{(fmt.category === "pair" && !isBtb) && trnData.target_size ? ` · ${Math.floor(trnData.target_size / 2)} ${tr("trn_pairs").toLowerCase()}` : ""}</span>
          </span>
        </div>
      </div>
      {trnData.description && (
        <div className="trp-desc">{trnData.description}</div>
      )}
      {trnData.contact_name && (
        <div className="trp-contact">
          <span className="trp-avatar">{trnData.contact_name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</span>
          <div style={{ minWidth: 0 }}>
            <div className="trp-contact-label">{tr("trn_contact_name_label")}</div>
            <div className="trp-contact-name">{trnData.contact_name}{trnData.contact_link && <span style={{ color: "var(--mut)", fontWeight: 400 }}> · {trnData.contact_link}</span>}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TournamentView ────────────────────────────────────────────────────────────

export function TournamentView({ id, players, back, readOnly = false, initialT = null, reloadFn = null, isGroupMember = false, currentProfileId = null, spectatorMode = false, onArchiveChange = null, isAdmin = false, membersCanCreate = false, onOpenPlayer = null }) {
  const isWide = useIsWide();     // на wide деталь в сплите рядом со списком → «К списку» не нужна
  useEffect(() => { if (back) return registerBack(back); }, [back]);
  const hasInitRef = useRef(!!initialT);
  const [trnData, setTrnData] = useState(initialT ? { ...initialT, matches: initialT.matches || [], players: initialT.players || [] } : null);
  const [toast, setToast] = useState("");
  const [cur, setCur] = useState(1);
  const [addingRound, setAddingRound] = useState(false);
  const [pinShown, setPinShown] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinMsg, setPinMsg] = useState(""); // #1: сообщение о неверном PIN — отдельно от toast (кнопки «Ссылка»)
  const [unlocked, setUnlocked] = useState(() => { try { return !!localStorage.getItem("pp_scorepin_" + id); } catch (e) { return false; } });
  const [addingToPair, setAddingToPair] = useState(null); // pair_no | "new" | null — куда добавляем
  const [combining, setCombining] = useState(false);       // «собрать неполные пары»
  const [openCourts, setOpenCourts] = useState({}); // {matchId: true} — раскрытые сыгранные корты
  const [tvOpen, setTvOpen] = useState(false); // полноэкранное ТВ-табло турнира
  const initRef = useRef(false);
  const roundRef = useRef(false);
  const startingRef = useRef(false);
  const [burst, setBurst] = useState(0);
  const [cardBusy, setCardBusy] = useState(false); // готовим карточку-подиум
  const [defCur, setDefCur] = useState("EUR");
  useEffect(() => { defaultCurrency().then(setDefCur).catch(() => {}); }, []);
  const firedRef = useRef(false);
  const trnStatus = trnData?.status;
  useEffect(() => {
    if (trnStatus === "finished" && !firedRef.current) { firedRef.current = true; setBurst((b) => b + 1); }
  }, [trnStatus]);

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
  const _dogAv = (pid, name) => pid ? playerAvatar(null, pid, name) : null;
  const avatarOfTp = (tpId) => {
    const tp = trnData.players.find((p) => p.id === tpId);
    if (!tp) return null;
    const gp = (players || []).find((gp) => gp.id === tp.profile_id);
    // tp.avatar_url приходит из get_tournament_by_code (гостевая страница /t,
    // где ростер лиги недоступен) — реальные фото вместо собак-заглушек.
    return gp?.avatar_url || tp.avatar_url || tp.profile?.avatar_url || (tp.profile_id ? _dogAv(tp.profile_id, tp.profile?.name || tp.name) : null);
  };

  const isPairFmt = fmt.category === "pair" && !isBtb; // BtB тоже category:"pair", но без pair_no
  const playedForTable = trnData.matches.filter((m) => m.round_number > 0);
  const table = isPairFmt
    ? pairStandings(trnData.players, playedForTable)
    : detailedStandings(trnData.players.map((p) => ({ id: p.id, name: p.name })), playedForTable);

  // Карточка-подиум для шаринга: топ-3 из standings, canvas → PNG → шеринг.
  const sharePodium = async () => {
    if (cardBusy || !table[0]) return;
    setCardBusy(true);
    try {
      const rounds = (trnData.matches || []).reduce((mx, m) => Math.max(mx, m.round_number || 0), 0);
      const metaStr = tr("sc_trn_meta")
        .replace("{p}", String((trnData.players || []).length))
        .replace("{r}", String(rounds))
        .replace("{n}", String(trnData.points_per_game));
      const dateStr = (() => { try { return new Date(trnData.starts_at || trnData.created_at).toLocaleDateString(dateLocale(), { day: "numeric", month: "long" }); } catch (e) { return ""; } })();
      const { renderTournamentCard, shareCanvas } = await import("../lib/shareCard");
      const canvas = await renderTournamentCard({
        name: trnData.name || fmt.name, dateStr, metaStr,
        top3: table.slice(0, 3).map((row) => ({
          name: row.name, avatar_url: avatarOfTp(row.id), id: row.id, points: row.points,
          avatars: Array.isArray(row.ids) && row.ids.length > 1 ? row.ids.map((pid) => avatarOfTp(pid)) : null,
          names: row.names || null,
        })),
      });
      await shareCanvas(canvas, "padelpack-podium.png");
    } catch (e) { /* отменили шеринг — молча */ }
    finally { setCardBusy(false); }
  };

  // Победитель финального экрана: для KotH — пара по выбранному правилу, иначе — лидер таблицы.
  // Чемпион парного формата — строка-ПАРА в table (по pair_no игрока-чемпиона из
  // kothChampionPair); иначе (solo) — лидер таблицы.
  const kothPair = isKoth && trnData.status === "finished" ? kothChampionPair(trnData) : null;
  const champPairNo = kothPair
    ? (trnData.players.find((p) => kothPair.includes(p.id))?.pair_no ?? null)
    : null;
  const champ = isPairFmt
    ? (champPairNo != null ? table.find((r) => r.pair_no === champPairNo) : table[0])
    : table[0];
  const champRowId = champ?.id || null; // для подсветки строки-пары
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

  const pairFmt = fmt.category === "pair" && !isBtb; // king_of_hill (и будущий round_robin)
  const countOk = isBtb
    ? trnData.players.length >= 4 && trnData.players.length % 2 === 0
    : trnData.players.length >= 4 && trnData.players.length % 4 === 0;
  // Для парных форматов дополнительно требуем, чтобы все были в ПОЛНЫХ парах.
  const canStart = countOk && (!pairFmt || allPaired(trnData.players));
  const startHint = (isBtb
    ? (trnData.players.length % 2 !== 0 ? tr("trn_need_even") : null)
    : (trnData.players.length % 4 !== 0 ? tr("trn_need_mult4") : null))
    || (pairFmt && countOk && !allPaired(trnData.players) ? tr("trn_need_pairs") : null);

  const addMexicanoRound = async () => {
    if (roundRef.current) return; roundRef.current = true;
    setAddingRound(true);
    try { await generateMexicanoRound(trnData.id, trnData.players, trnData.matches); await load(); setCur(N + 1); }
    catch (e) { showToast(e.message || tr("err_create_round")); }
    finally { setAddingRound(false); roundRef.current = false; }
  };

  const addKotHMatch = async () => {
    if (roundRef.current) return; roundRef.current = true;
    setAddingRound(true);
    try { await generateKotHRound(trnData.id, trnData.matches); await load(); setCur(N + 1); }
    catch (e) { showToast(e.message || tr("err_create_match")); }
    finally { setAddingRound(false); roundRef.current = false; }
  };

  const addKotHLadderRound = async () => {
    if (roundRef.current) return; roundRef.current = true;
    setAddingRound(true);
    try { await generateKotHLadderRound(trnData.id, trnData.matches); await load(); setCur(N + 1); }
    catch (e) { showToast(e.message || tr("err_create_round")); }
    finally { setAddingRound(false); roundRef.current = false; }
  };

  const share = async () => {
    const url = tournamentLink(trnData.invite_code);
    const text = `${tr("trn_share_text")}${trnData.name ? ` «${trnData.name}»` : ""}: ${url}`;
    // На нативе — тот же Capacitor Share-плагин, что и у подиума/пары (веб-navigator.share
    // в Android-WebView показывает лишнее окно редактирования текста «Изменить»).
    // Только text (в нём уже есть ссылка + код). url отдельно НЕ передаём — иначе
    // Share-плагин склеивает text+url и ссылка задваивается.
    const Share = (typeof window !== "undefined" && window.Capacitor?.Plugins?.Share) || null;
    if (Share) { try { await Share.share({ title: tr("tab_tournaments"), text }); return; } catch (e) { if (/cancel/i.test(e?.message || "")) return; } }
    try { if (navigator.share) { await navigator.share({ title: tr("tab_tournaments"), text }); return; } } catch (e) {}
    try { await navigator.clipboard.writeText(text); setToast(tr("copied")); setTimeout(() => setToast(""), 1500); } catch (e) {}
  };
  const sharePairLink = async (pairNo) => {
    const url = `${tournamentLink(trnData.invite_code)}?pair=${pairNo}`;
    const Share = (typeof window !== "undefined" && window.Capacitor?.Plugins?.Share) || null;
    if (Share) { try { await Share.share({ url }); return; } catch (e) { /* отмена — ок */ } }
    try { await navigator.clipboard.writeText(url); showToast(tr("copied")); }
    catch (e) { showToast(tr("copy_manual")); }
  };
  const start = async () => {
    if (startingRef.current) return;
    // Старт с неполным набором разрешён (кратность соблюдена), но не молча:
    // «собирали 8, стартуем с 4» должно быть осознанным решением организатора.
    if (trnData.players.length < trnData.target_size &&
        !(await confirmDialog({ title: tr("trn_start_title"), message: tr("trn_start_short").replace("{n}", String(trnData.players.length)).replace("{t}", String(trnData.target_size)), confirmLabel: tr("trn_start_btn"), danger: false }))) return;
    startingRef.current = true;
    try { await startTournament(trnData.id, trnData.players, trnData.format); await load(); }
    catch (e) { showToast(e.message || tr("err_start_tour")); }
    finally { startingRef.current = false; }
  };
  const saveScore = async (matchId, a, b) => {
    let pin = null; try { pin = localStorage.getItem("pp_scorepin_" + id); } catch (e) {}
    await submitMatchScore(matchId, a, b, pin || ""); await load();
  };
  const genPin = async () => {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    try { await setScorePin(trnData.id, pin); setPinShown(pin); } catch (e) { showToast(e.message || tr("err_generic")); }
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

  // Удаление турнира: колбэк для афиши (TournamentPoster) — та же логика, что раньше
  // жила инлайном в JSX афиши. isGroupMember решает, показывать ли кнопку вовсе.
  const deleteTr = async () => {
    if (!(await confirmDialog({ title: tr("trn_delete_confirm"), message: tr("trn_delete_msg"), confirmLabel: tr("delete_btn") }))) return;
    try { await deleteTournament(id); onArchiveChange?.(); back?.(); } catch (e) { showToast(tr("err_delete")); }
  };

  return (
    <div className="tr-root">
      <style>{css}</style>
      {back && !isWide && (
        <BackButton onClick={back} label={tr("trn_to_list")} style={{ marginBottom: 12 }} />
      )}

      <TournamentPoster trnData={trnData} fmt={fmt} readOnly={readOnly} isKoth={isKoth} isBtb={isBtb}
        isGroupMember={isGroupMember} toast={toast} avatarOfTp={avatarOfTp}
        onShare={share} onTv={() => setTvOpen(true)} onDelete={deleteTr} />

      {/* Турнир со свободным счётом: PIN-карточка не нужна — короткая пометка */}
      {trnData.status === "active" && !readOnly && trnData.open_scoring && (
        <div className="tr-card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: "var(--lime)", display: "flex", alignItems: "center", gap: 6 }}><Check size={14} /> {tr("trn_score_open")}</div>
        </div>
      )}
      {trnData.status === "active" && !readOnly && !trnData.open_scoring && (
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
            {(fmt.category === "pair" && !isBtb) ? (() => {
              const { pairs, pool } = groupPairs(trnData.players);
              const pairCap = Math.floor((trnData.target_size || 0) / 2);
              const done = pairs.filter((pr) => pr.members.length === 2).length;
              // Строка игрока внутри пары/пула: аватар + имя + (тап на профиль) + ✕
              const member = (p) => {
                const tap = onOpenPlayer && p.profile_id ? () => onOpenPlayer(p.profile_id) : null;
                return (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, flex: "1 1 0" }}>
                    <span onClick={tap || undefined} style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, flex: "1 1 0", cursor: tap ? "pointer" : "default" }}>
                      <Avatar name={p.name} url={avatarOfTp(p.id)} id={p.profile_id} size={26} />
                      <span style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{p.name}</span>
                    </span>
                    {!readOnly && (
                      <button aria-label={tr("delete_btn")} onClick={async () => { try { await removeTournamentPlayer(p.id); } catch (e) {} load(); }}
                        style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", border: "none", background: "color-mix(in srgb, var(--coral) 16%, transparent)", color: "var(--coral)", display: "grid", placeItems: "center", cursor: "pointer" }}>
                        <X size={12} />
                      </button>
                    )}
                  </span>
                );
              };
              return (
                <>
                  <div style={{ fontSize: 12, color: "var(--mut)", fontWeight: 700, marginBottom: 8 }}>{tr("trn_pairs")} {done}/{pairCap}</div>
                  {pairs.map((pr) => (
                    <div key={pr.pair_no} style={{ padding: "9px 4px", borderBottom: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 16, flexShrink: 0, fontWeight: 800, color: "var(--mut)", fontSize: 13, textAlign: "center" }}>{pr.pair_no}</span>
                        {member(pr.members[0])}
                        {pr.members[1] && <span style={{ color: "var(--mut)", fontWeight: 700, flexShrink: 0 }}>&amp;</span>}
                        {pr.members[1]
                          ? member(pr.members[1])
                          : (readOnly && <span style={{ color: "var(--mut)", fontSize: 12.5, flexShrink: 0 }}>{tr("trn_looking_partner")}</span>)}
                      </div>
                      {/* Пустой второй слот: контролы (напарник + ссылка на пару) и подсказка —
                          отдельной строкой с переносом; в узкой строке ссылка уезжала за экран. */}
                      {!pr.members[1] && !readOnly && (
                        <div style={{ marginLeft: 24, marginTop: 7 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <button onClick={() => setAddingToPair(pr.pair_no)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1.5px dashed color-mix(in srgb, var(--lime) 45%, transparent)", background: "none", borderRadius: 999, padding: "5px 12px", color: "var(--lime)", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                              ＋ {tr("trn_choose_partner")}
                            </button>
                            <button onClick={() => sharePairLink(pr.pair_no)} aria-label={tr("trn_share_pair")}
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 999, padding: "5px 12px", color: "var(--ink)", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>🔗 {tr("trn_share_pair")}</button>
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--mut)", lineHeight: 1.3, marginTop: 6 }}>{tr("trn_share_pair_hint")}</div>
                        </div>
                      )}
                    </div>
                  ))}
                  {pool.length > 0 && (
                    <>
                      <div style={{ fontSize: 11.5, color: "var(--mut)", textTransform: "uppercase", letterSpacing: .5, fontWeight: 800, margin: "10px 0 6px" }}>{tr("trn_no_pair")}</div>
                      {pool.map((p) => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", padding: "8px 4px", borderBottom: "1px solid var(--line)" }}>{member(p)}</div>
                      ))}
                    </>
                  )}
                  {/* Собрать неполные пары: одиночек (по 1 в паре + без пары) складываем
                      попарно. Полезно, когда «турнир заполнен», но пары не собраны. */}
                  {!readOnly && addingToPair == null && (pairs.filter((pr) => pr.members.length === 1).length + pool.length) >= 2 && (
                    <button onClick={async () => {
                      if (combining) return;
                      setCombining(true);
                      try { await combineIncompletePairs(trnData.id, trnData.players); await load(); }
                      catch (e) { showToast(tr("err_generic")); }
                      finally { setCombining(false); }
                    }} className="tr-ghost" disabled={combining}
                      style={{ width: "100%", marginTop: 12, padding: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--lime)", borderColor: "color-mix(in srgb, var(--lime) 40%, transparent)", fontWeight: 700, opacity: combining ? .6 : 1 }}>
                      🔗 {tr("trn_combine_pairs")}
                    </button>
                  )}
                  {!readOnly && addingToPair == null && trnData.players.length < trnData.target_size && (
                    <button onClick={() => setAddingToPair("new")} className="tr-btn" style={{ marginTop: 12, background: "color-mix(in srgb, var(--lime) 12%, transparent)", color: "var(--lime)", border: "1px solid color-mix(in srgb, var(--lime) 40%, transparent)" }}>
                      ＋ {tr("trn_new_pair")}
                    </button>
                  )}
                  {!readOnly && addingToPair != null && (
                    <div style={{ marginTop: 10 }}>
                      <AddPlayer players={players} existing={trnData.players} meId={currentProfileId}
                        disabled={trnData.players.length >= trnData.target_size}
                        onAdd={async (entry) => {
                          const pairNo = addingToPair === "new" ? nextPairNo(trnData.players) : addingToPair;
                          try {
                            await addTournamentPlayer(trnData.id, { ...entry, pairNo });
                            await load(); setAddingToPair(null);   // await: следующий nextPairNo — по свежему списку
                          } catch (e) {
                            showToast(e?.message === "pair_full" ? tr("err_slot_taken") : (e?.message || tr("err_add_player")));
                            await load();
                          }
                        }} />
                    </div>
                  )}
                </>
              );
            })() : (
              <>
                {/* Широкий экран: крупные профиль-карточки как в гостевом ростере
                    (аватар 58 + имя, ✕ в углу). Узкий — компактные строки. */}
                {isWide ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(116px, 1fr))", gap: 10 }}>
                    {trnData.players.map((p) => {
                      const tap = onOpenPlayer && p.profile_id ? () => onOpenPlayer(p.profile_id) : null;
                      const meCard = p.profile_id === currentProfileId;
                      return (
                        <div key={p.id} onClick={tap || undefined}
                          style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8, padding: "16px 8px 13px", borderRadius: 16, cursor: tap ? "pointer" : "default", minWidth: 0,
                            border: meCard ? "1.5px solid color-mix(in srgb, var(--lime) 55%, transparent)" : "1px solid var(--line)",
                            background: meCard ? "color-mix(in srgb, var(--lime) 8%, transparent)" : "var(--surface)" }}>
                          <div style={{ position: "relative" }}>
                            <Avatar name={p.name} url={avatarOfTp(p.id)} id={p.profile_id} size={58} />
                            {!readOnly && (
                              <button aria-label={tr("delete_btn")} onClick={(e) => { e.stopPropagation(); (async () => { try { await removeTournamentPlayer(p.id); } catch (err) {} load(); })(); }}
                                style={{ position: "absolute", top: -2, right: -2, width: 22, height: 22, borderRadius: "50%", border: "2px solid var(--bg)", background: "var(--coral)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <X size={12} />
                              </button>
                            )}
                          </div>
                          <span style={{ maxWidth: "100%", fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)" }}>{p.name}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : trnData.players.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderBottom: "1px solid var(--line)", background: p.profile_id === currentProfileId ? "color-mix(in srgb, var(--lime) 10%, transparent)" : undefined, borderRadius: p.profile_id === currentProfileId ? 8 : undefined }}>
                    {(() => {
                      const tap = onOpenPlayer && p.profile_id ? () => onOpenPlayer(p.profile_id) : null;
                      return (
                        <div onClick={tap || undefined} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, cursor: tap ? "pointer" : "default" }}>
                          <Avatar name={p.name} url={avatarOfTp(p.id)} id={p.profile_id} size={34} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)" }}>{p.name}</span>
                        </div>
                      );
                    })()}
                    {!readOnly && (
                      <button aria-label={tr("delete_btn")} onClick={async () => { try { await removeTournamentPlayer(p.id); } catch (e) {} load(); }}
                        style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", border: "none", background: "color-mix(in srgb, var(--coral) 16%, transparent)", color: "var(--coral)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
                {/* Добор состава: единый инструмент — «Я сам» первым чипом карусели
                    (заменил отдельную кнопку «Записаться»), дальше лига, поиск, гость. */}
                {!readOnly && (
                  <AddPlayer players={players} existing={trnData.players} meId={currentProfileId}
                    disabled={trnData.players.length >= trnData.target_size}
                    onAdd={async (entry) => { try { await addTournamentPlayer(trnData.id, entry); } catch (e) { showToast(e?.message || tr("err_add_player")); } load(); }} />
                )}
              </>
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
                {/* Правило чемпиона KotH теперь в афише (шапке), не дублируем среди раундов */}
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
                      editable={!readOnly && (unlocked || isAdmin || (amCreator && membersCanCreate) || !!trnData.open_scoring) && trnData.status !== "finished" && priorComplete}
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

              {/* Finish tournament: у форматов с фиксированными раундами (американо)
                  после последнего счёта это ЕДИНСТВЕННОЕ действие — кнопка первичная;
                  у мексикано/BtB рядом есть «Следующий раунд» — остаётся вторичной,
                  но заметной (лаймовый контур вместо серого призрака). */}
              {!readOnly && trnData.status !== "finished" && (
                ((isMexicano || isKothBtB) && curComplete && isLastRound) || (!isMexicano && !isKothBtB && done)
              ) && (() => {
                const primary = !isMexicano && !isKothBtB;
                return (
                  <button className={primary ? "tr-btn" : "tr-ghost"}
                    style={{ width: "100%", padding: 12, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      ...(primary ? { fontSize: 15 } : { color: "var(--lime)", border: "1px solid color-mix(in srgb, var(--lime) 45%, transparent)", background: "color-mix(in srgb, var(--lime) 10%, transparent)", fontWeight: 700 }) }}
                    onClick={async () => { await finishTournament(trnData.id); load(); }}>
                    <Trophy size={16} /> {tr("trn_finish_tournament")}
                  </button>
                );
              })()}
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
                {/* Карточка-подиум в чаты: тем же движком, что карточка игры */}
                <button className="tr-btn" disabled={cardBusy} onClick={sharePodium}
                  style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14 }}>
                  📸 {cardBusy ? tr("sc_making") : tr("sc_share_podium")}
                </button>
              </div>
            )}
            {trnData.status === "finished" && <Confetti burst={burst} />}
            <StandingsTable rows={table}
              highlightId={isPairFmt
                ? (() => { const me = (trnData.players || []).find((p) => p.profile_id === currentProfileId); return me?.pair_no != null ? `pair-${me.pair_no}` : null; })()
                : (trnData.players || []).find((p) => p.profile_id === currentProfileId)?.id}
              avatarUrlOf={avatarOfTp}
              championIds={trnData.status === "finished" && isPairFmt && champRowId ? [champRowId] : null} />
          </div>

          {/* Взносы — отдельным блоком в САМОМ НИЗУ и СВЁРНУТО (компактно, раскрыть по тапу):
              не для зрителей; тайминг (fee_timing) — только подсказка; карточка сама скрывается,
              пока сумма не задана и ты не организатор. */}
          {!spectatorMode && (
            <FeesCard entityId={trnData.id} entityName={trnData.name} collapsible
              players={(trnData.players || []).map((p) => ({ key: p.id, profile_id: p.profile_id, name: p.name }))}
              me={currentProfileId} readOnly={readOnly}
              canManage={isAdmin || trnData.created_by === currentProfileId}
              avatarOf={avatarOfTp}
              currency={trnData.fee_currency} timing={trnData.fee_timing} defaultCurrency={defCur}
              onChange={load}
              api={{ getFee: getTournamentFee, getPaid: getFeePayments, setFee: setTournamentFee, togglePaid: toggleFeePaid, remind: remindFeeDebtors }} />
          )}
        </>
      )}
      {/* Портал в body: внутри анимированных контейнеров (.pl-pop / transform)
          position:fixed считается от предка — оверлей не накрывал шапку и FAB. */}
      {tvOpen && createPortal(
        <Suspense fallback={null}>
          <TvBoardLazy initial={trnData} onClose={() => setTvOpen(false)} />
        </Suspense>,
        document.body
      )}
    </div>
  );
}
