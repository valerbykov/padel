// TvBoard — полноэкранное ТВ-табло турнира (ТВ клуба / планшет на стойке).
// Два режима: initial (ин-апп, данные от родителя) и code (публичный /tv/CODE,
// поллинг публичного RPC). Экран турнира вынесен в TvTournamentScreen и
// переиспользуется в ClubTv (единый «ТВ клуба» с ротацией — /tv/l/CODE).
// Дизайн — тема-НЕЗАВИСИМый (фикс-палитра в TV_CSS), подложка падел-корта под
// углом, крупный счёт, LIVE-пилюля, таблица В·Н·П/Очки/Δ. Размеры в cqw —
// относительно ширины табло (container-type:inline-size), корректно на любом ТВ.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getTournamentByCode } from "../lib/tournamentApi";
import { detailedStandings, pairStandings } from "../lib/americano";
import { fmtById } from "./Tournaments";
import { useWakeLock } from "../lib/useWakeLock";
import { t as tr, dateLocale } from "../lib/i18n";

// ── Единая CSS-система табло (фикс тёмная палитра прибита к .pptv) ───────────
export const TV_CSS = `
.pptv{--void:#060d0a;--panel:#0e1f17;--panel2:#15281e;--line:rgba(200,255,45,.13);
  --ink:#eef3ee;--white:#ffffff;--mut:#6f8579;--accent:#c8ff2d;--live:#ff4d43;--up:#ffd23f;
  color-scheme:dark;position:fixed;inset:0;z-index:500;overflow:hidden;color:var(--ink);
  container-type:inline-size;font-family:'Outfit',sans-serif;display:flex;flex-direction:column;
  padding:3cqw 3.4cqw;background:radial-gradient(75% 55% at 50% 0%,rgba(200,255,45,.12),transparent 60%),linear-gradient(160deg,#0a1c14 0%,var(--void) 74%);}
.pptv *{box-sizing:border-box;}
.pptv-bg{position:absolute;inset:-20%;z-index:0;pointer-events:none;transform:rotate(-9deg) scale(1.15);
  background:linear-gradient(180deg,rgba(6,13,10,.5),rgba(6,13,10,.84)),url(/padel-court.png) center/cover no-repeat;
  filter:brightness(.5) saturate(.8);opacity:.7;}
.pptv-grain{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.05;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
.pptv .z{position:relative;z-index:1;}

.pptv-head{display:flex;align-items:center;gap:1.4cqw;position:relative;z-index:1;}
.pptv-logo{width:3.6cqw;height:3.6cqw;min-width:44px;min-height:44px;border-radius:12px;display:grid;place-items:center;overflow:hidden;
  background:radial-gradient(circle at 30% 25%,rgba(200,255,45,.35),rgba(200,255,45,.1));box-shadow:0 0 0 1px var(--line),0 0 24px rgba(200,255,45,.25);color:var(--accent);font-weight:900;font-size:1.9cqw;}
.pptv-logo img{width:100%;height:100%;object-fit:cover;}
.pptv-nm{font-size:2cqw;font-weight:900;letter-spacing:-.02cqw;color:var(--white);line-height:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:44cqw;}
.pptv-sub{font-size:1cqw;font-weight:800;letter-spacing:.18cqw;text-transform:uppercase;color:var(--mut);margin-top:.3cqw;}
.pptv-live{margin-left:1cqw;display:inline-flex;align-items:center;gap:.55cqw;background:rgba(255,77,67,.14);border:1px solid rgba(255,77,67,.4);color:var(--live);font-weight:900;font-size:1.05cqw;letter-spacing:.12cqw;padding:.5cqw 1cqw;border-radius:999px;flex-shrink:0;}
.pptv-live i{width:.85cqw;height:.85cqw;border-radius:50%;background:var(--live);animation:pptvp 1.2s ease-in-out infinite;}
@keyframes pptvp{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.82)}}
.pptv-clock{margin-left:auto;font-family:'Anton',sans-serif;font-size:3cqw;color:var(--white);letter-spacing:.05cqw;line-height:1;font-variant-numeric:tabular-nums;flex-shrink:0;}
.pptv-roundwrap{display:flex;align-items:center;gap:1.2cqw;margin:1.1cqw 0 .2cqw;position:relative;z-index:1;}
.pptv-rlab{font-size:1.1cqw;font-weight:900;letter-spacing:.14cqw;text-transform:uppercase;color:var(--mut);white-space:nowrap;}
.pptv-rlab b{color:var(--white);}
.pptv-dots{display:flex;gap:.5cqw;flex:1;}
.pptv-dots i{height:.55cqw;flex:1;border-radius:99px;background:rgba(255,255,255,.1);}
.pptv-dots i.done{background:var(--accent);}
.pptv-dots i.now{background:linear-gradient(90deg,var(--accent) 55%,rgba(255,255,255,.12) 55%);}

.pptv-tbody{flex:1;display:grid;grid-template-columns:minmax(0,1.32fr) minmax(0,1.05fr);gap:1.8cqw;margin-top:1.1cqw;min-height:0;position:relative;z-index:1;}
/* --cs — масштаб контента корта (уменьшается при многих кортах); --cc — колонки */
.pptv-courts{display:grid;grid-template-columns:repeat(var(--cc,2),minmax(0,1fr));gap:calc(1.4cqw * var(--cs,1));min-height:0;min-width:0;}
.pptv-court{position:relative;min-width:0;overflow:hidden;border-radius:1.2cqw;padding:calc(1.4cqw * var(--cs,1));display:flex;flex-direction:column;justify-content:space-between;
  background:linear-gradient(180deg,var(--panel) 0%,#0b1a13 100%);box-shadow:inset 0 0 0 1px var(--line),inset 0 .4cqw 0 -.2cqw rgba(200,255,45,.5);}
.pptv-court::before{content:"";position:absolute;inset:1.1cqw;border:1px solid rgba(255,255,255,.06);border-radius:.6cqw;background:linear-gradient(rgba(255,255,255,.05),rgba(255,255,255,.05)) center/100% 1px no-repeat;}
.pptv-clab{display:inline-flex;align-items:center;gap:.5cqw;font-size:calc(1cqw * var(--cs,1));font-weight:900;letter-spacing:.1cqw;text-transform:uppercase;color:var(--mut);position:relative;white-space:nowrap;}
.pptv-court.live .pptv-clab i{width:calc(.7cqw * var(--cs,1));height:calc(.7cqw * var(--cs,1));border-radius:50%;background:var(--live);animation:pptvp 1.2s ease-in-out infinite;}
.pptv-lineup{display:flex;flex-direction:column;gap:calc(.9cqw * var(--cs,1));margin-top:.6cqw;position:relative;}
.pptv-tm{display:flex;align-items:center;gap:.8cqw;min-width:0;}
.pptv-pv{display:flex;flex-shrink:0;}
.pptv-pv .a{width:calc(3cqw * var(--cs,1));height:calc(3cqw * var(--cs,1));min-width:20px;min-height:20px;border-radius:50%;border:.2cqw solid #0b1a13;display:grid;place-items:center;font-size:calc(1.1cqw * var(--cs,1));font-weight:800;color:#fff;overflow:hidden;box-shadow:0 .3cqw .7cqw rgba(0,0,0,.35);}
.pptv-pv .a img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
.pptv-pv .a+.a{margin-left:-.95cqw;}
.pptv-tm .nm{font-size:calc(1.55cqw * var(--cs,1));font-weight:700;color:var(--ink);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pptv-tm.win .nm{color:var(--white);font-weight:800;border-bottom:.25cqw solid var(--accent);padding-bottom:.1cqw;}
.pptv-tm.lose .nm{opacity:.55;}
.pptv-scoreline{display:flex;align-items:baseline;justify-content:center;gap:1.2cqw;font-family:'Anton',sans-serif;line-height:.82;position:relative;}
.pptv-scoreline .d{font-size:calc(6.6cqw * var(--cs,1));color:var(--white);font-variant-numeric:tabular-nums;}
.pptv-scoreline .d.win{color:var(--accent);}
.pptv-scoreline .d.lose{opacity:.45;}
.pptv-scoreline .sep{font-size:calc(4cqw * var(--cs,1));color:var(--mut);}
.pptv-morec{grid-column:1/-1;text-align:center;color:var(--mut);font-size:1.2cqw;font-weight:800;letter-spacing:.1cqw;padding:.4cqw;}

.pptv-tbl{background:rgba(6,13,10,.5);border:1px solid var(--line);border-radius:1.4cqw;padding:1cqw 1cqw .8cqw;display:flex;flex-direction:column;min-height:0;min-width:0;}
.pptv-tgrid{display:grid;grid-template-columns:1.8cqw minmax(0,1fr) 4.2cqw 3cqw 2.8cqw;gap:.7cqw;align-items:center;}
.pptv-thead{font-size:.82cqw;font-weight:900;letter-spacing:.05cqw;text-transform:uppercase;color:var(--mut);padding:0 .3cqw .5cqw .6cqw;border-bottom:1px solid var(--line);margin-bottom:.3cqw;}
.pptv-thead span{text-align:center;}.pptv-thead .l{text-align:left;}
.pptv-trow{padding:.42cqw .3cqw .42cqw .6cqw;position:relative;border-radius:.5cqw;}
.pptv-trow .rk{font-family:'Anton',sans-serif;font-size:1.7cqw;color:var(--mut);text-align:center;font-variant-numeric:tabular-nums;}
.pptv-trow .who{font-size:1.35cqw;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pptv-trow .wdl{font-size:1.15cqw;font-weight:700;color:var(--mut);text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap;}
.pptv-trow .pt{font-family:'Anton',sans-serif;font-size:1.95cqw;color:var(--white);text-align:center;font-variant-numeric:tabular-nums;}
.pptv-trow .dl{font-size:1.15cqw;font-weight:800;text-align:center;font-variant-numeric:tabular-nums;}
.pptv-trow.lead{background:linear-gradient(90deg,rgba(200,255,45,.13),transparent 82%);}
.pptv-trow.lead::before{content:"";position:absolute;left:-.2cqw;top:14%;bottom:14%;width:.4cqw;border-radius:99px;background:var(--accent);}
.pptv-trow.lead .rk,.pptv-trow.lead .pt{color:var(--accent);}.pptv-trow.lead .who{color:var(--white);font-weight:800;}

.pptv-lgbody{flex:1;display:flex;flex-direction:column;gap:.6cqw;margin-top:1.3cqw;position:relative;z-index:1;}
.pptv-lr{display:flex;align-items:center;gap:1.6cqw;padding:.6cqw 1.4cqw;border-radius:1cqw;position:relative;}
.pptv-lr .rk{font-family:'Anton',sans-serif;font-size:2.6cqw;color:var(--mut);width:3cqw;text-align:center;font-variant-numeric:tabular-nums;}
.pptv-lr .av{width:3.2cqw;height:3.2cqw;min-width:30px;min-height:30px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;font-size:1.3cqw;font-weight:800;color:#fff;overflow:hidden;box-shadow:0 .3cqw .8cqw rgba(0,0,0,.4);}
.pptv-lr .av img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
.pptv-lr .nm{flex:1;font-size:2.4cqw;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pptv-lr .gm{font-size:1.3cqw;font-weight:700;color:var(--mut);flex-shrink:0;}
.pptv-lr .rt{font-family:'Anton',sans-serif;font-size:3cqw;color:var(--white);min-width:5cqw;text-align:right;font-variant-numeric:tabular-nums;}
.pptv-lr.lead{background:linear-gradient(90deg,rgba(200,255,45,.15),transparent 75%);padding-top:.9cqw;padding-bottom:.9cqw;}
.pptv-lr.lead::before{content:"";position:absolute;left:0;top:14%;bottom:14%;width:.5cqw;border-radius:99px;background:var(--accent);}
.pptv-lr.lead .rk,.pptv-lr.lead .rt{color:var(--accent);}.pptv-lr.lead .nm{color:var(--white);font-weight:900;font-size:2.7cqw;}
/* Без лаймового кольца у аватара — в приложении это кольцо значит другое. */
.pptv-lr.lead .av{width:3.8cqw;height:3.8cqw;}

.pptv-split{flex:1;display:grid;grid-template-columns:1.35fr 1fr;gap:2.4cqw;margin-top:1.2cqw;position:relative;z-index:1;align-items:center;}
.pptv-hero .tag{display:inline-block;font-size:1cqw;font-weight:900;letter-spacing:.16cqw;text-transform:uppercase;color:#0a1612;background:var(--up);border-radius:99px;padding:.4cqw 1.1cqw;}
.pptv-hero .tag.lime{background:var(--accent);}
.pptv-hero .when{font-family:'Anton',sans-serif;font-size:6cqw;color:var(--white);line-height:.9;margin:.9cqw 0 .3cqw;font-variant-numeric:tabular-nums;}
.pptv-hero .ev{font-size:2.3cqw;font-weight:800;color:var(--ink);}
.pptv-hero .pl{font-size:1.35cqw;color:var(--mut);margin-top:.5cqw;}
.pptv-hero .seats{display:inline-flex;align-items:center;gap:.6cqw;margin-top:1.1cqw;font-size:1.5cqw;font-weight:800;color:var(--up);}
.pptv-hero h1{font-size:3.6cqw;font-weight:900;color:var(--white);line-height:1.02;letter-spacing:-.03cqw;margin:.6cqw 0 1cqw;}
.pptv-hero h1 .g{color:var(--accent);}
.pptv-props{display:flex;flex-direction:column;gap:.9cqw;}
.pptv-props div{font-size:1.6cqw;font-weight:600;color:var(--ink);display:flex;align-items:center;gap:1cqw;}
.pptv-props div b{color:var(--accent);font-size:1.9cqw;width:2cqw;text-align:center;}
.pptv-stores{margin-top:1.4cqw;font-size:1.3cqw;font-weight:800;color:var(--mut);letter-spacing:.05cqw;}

.pptv-qr{position:relative;border-radius:1.6cqw;background:#fff;padding:1.4cqw;display:grid;place-items:center;}
.pptv-qr.big{justify-self:end;width:20cqw;height:20cqw;max-width:340px;max-height:340px;}
.pptv-qr.sm{width:7.5cqw;height:7.5cqw;min-width:90px;min-height:90px;padding:.55cqw;border-radius:1cqw;}
.pptv-qr svg{width:100%;height:100%;display:block;}
.pptv-qr .cn{position:absolute;border:.4cqw solid var(--accent);}
.pptv-qr.big .cn{width:2.4cqw;height:2.4cqw;}
.pptv-qr.sm .cn{width:1.3cqw;height:1.3cqw;border-width:.28cqw;}
.pptv-qr.big .cn.tl{top:-.7cqw;left:-.7cqw;}.pptv-qr.sm .cn.tl{top:-.45cqw;left:-.45cqw;}
.pptv-qr.big .cn.tr{top:-.7cqw;right:-.7cqw;}.pptv-qr.sm .cn.tr{top:-.45cqw;right:-.45cqw;}
.pptv-qr.big .cn.bl{bottom:-.7cqw;left:-.7cqw;}.pptv-qr.sm .cn.bl{bottom:-.45cqw;left:-.45cqw;}
.pptv-qr.big .cn.br{bottom:-.7cqw;right:-.7cqw;}.pptv-qr.sm .cn.br{bottom:-.45cqw;right:-.45cqw;}
.pptv-qr .cn.tl{border-right:0;border-bottom:0;border-radius:.5cqw 0 0 0;}
.pptv-qr .cn.tr{border-left:0;border-bottom:0;border-radius:0 .5cqw 0 0;}
.pptv-qr .cn.bl{border-right:0;border-top:0;border-radius:0 0 0 .5cqw;}
.pptv-qr .cn.br{border-left:0;border-top:0;border-radius:0 0 .5cqw 0;}
.pptv-scan{position:absolute;font-size:.95cqw;font-weight:900;letter-spacing:.12cqw;color:var(--accent);text-transform:uppercase;white-space:nowrap;}
.pptv-qr.big .pptv-scan{top:-2.5cqw;left:0;}.pptv-qr.sm .pptv-scan{top:-2cqw;right:0;}

.pptv-foot{display:flex;align-items:flex-end;gap:2cqw;position:relative;z-index:1;margin-top:.9cqw;}
.pptv-rot{display:flex;gap:.5cqw;}
.pptv-rot i{width:1.3cqw;height:.5cqw;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden;}
.pptv-rot i.on{width:2.8cqw;background:rgba(255,255,255,.14);}
.pptv-rot i.on b{display:block;height:100%;width:100%;background:var(--accent);transform-origin:left;animation:pptvfill linear forwards;}
@keyframes pptvfill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.pptv-close{position:absolute;top:2cqw;right:2.4cqw;z-index:3;width:4cqw;height:4cqw;min-width:40px;min-height:40px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid var(--line);color:var(--ink);font-size:2cqw;cursor:pointer;display:grid;place-items:center;}
.pptv-msg{position:fixed;inset:0;z-index:500;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color-scheme:dark;
  background:linear-gradient(160deg,#0a1c14,#060d0a);color:#eef3ee;font-family:'Outfit',sans-serif;padding:6cqw;}
@media (prefers-reduced-motion:reduce){.pptv *{animation:none !important;}.pptv-rot i.on b{transform:scaleX(1);}}
`;

let cssInjected = false;
function TvStyle() {
  // Один тег стилей на документ (несколько экземпляров табло не дублируют).
  useEffect(() => { cssInjected = true; return () => { cssInjected = false; }; }, []);
  return <style>{TV_CSS}</style>;
}

// ── Аватар: фото или инициалы (на ТВ собак не рисуем — чисто и читаемо) ──────
const AV_BG = ["#E63946", "#F4A261", "#2A9D8F", "#264653", "#457B9D", "#8E44AD", "#E76F51", "#3D5A80", "#6A4C93", "#1D8A99"];
function initialsOf(name) {
  const w = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  return (w.length >= 2 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
}
function bgOf(name) {
  const h = [...String(name || "")].reduce((a, c) => a + c.charCodeAt(0), 0);
  return AV_BG[h % AV_BG.length];
}
export function Av({ url, name, cls = "a" }) {
  return url
    ? <span className={cls} style={{ background: bgOf(name) }}><img src={url} alt="" /></span>
    : <span className={cls} style={{ background: bgOf(name) }}>{initialsOf(name)}</span>;
}

// ── Часы табло (тикают раз в 20с) ────────────────────────────────────────────
export function useTvClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(id); }, []);
  try { return new Date(now).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
}

// Затемнённая подложка падел-корта + зерно (общий фон всех экранов табло).
export function TvBackdrop() {
  return <><div className="pptv-bg" /><div className="pptv-grain" /></>;
}

export function TvMessage({ text, onClose = null }) {
  return (
    <div className="pptv-msg">
      <TvStyle />
      <div style={{ fontSize: "3cqw", fontWeight: 700, maxWidth: "70cqw", whiteSpace: "pre-line" }}>{text}</div>
      {onClose && <button className="pptv-close" style={{ position: "static", marginTop: "3cqw" }} onClick={onClose}>✕</button>}
    </div>
  );
}

// Аватары пары матча по id игроков (или гостей) турнира.
function pairAvatars(t, ids) {
  const players = t?.players || [];
  return (ids || []).filter(Boolean).map((id) => {
    const p = players.find((x) => x.id === id || x.profile_id === id);
    return { name: p?.name || "?", url: p?.avatar_url || null };
  });
}

// ── Экран одного турнира: шапка + прогресс раунда + корты + таблица ──────────
// В ClubTv шапку рисует общий бренд-блок → header=false, тогда рисуем только
// прогресс раунда и тело (без своей шапки-названия).
export function TvTournamentScreen({ t, clock, header = true }) {
  const fmt = t ? fmtById(t.format) : null;
  const isPairFmt = !!fmt && fmt.category === "pair" && t.format !== "beat_the_box";
  const table = useMemo(() => {
    if (!t) return [];
    return isPairFmt ? pairStandings(t.players || [], t.matches || [])
                     : detailedStandings(t.players || [], t.matches || []);
  }, [t, isPairFmt]);
  const rounds = useMemo(() => {
    const ms = t?.matches || [];
    return ms.reduce((mx, x) => Math.max(mx, x.round_number || 0), 0);
  }, [t]);
  const round = useMemo(() => {
    const ms = t?.matches || [];
    if (!ms.length) return 0;
    const unplayed = ms.filter((m) => m.score_a == null || m.score_b == null).map((m) => m.round_number || 1);
    return unplayed.length ? Math.min(...unplayed) : rounds;
  }, [t, rounds]);
  const courts = useMemo(() => (t?.matches || []).filter((m) => (m.round_number || 0) === round), [t, round]);
  const nameOf = (id) => (t?.players || []).find((p) => p.id === id)?.name || "—";

  const team = (m, side) => {
    const ids = side === "a" ? m.team_a : m.team_b;
    const names = (ids || []).map(nameOf).join(" & ");
    const won = side === "a" ? m.score_a > m.score_b : m.score_b > m.score_a;
    const cls = m.score_a != null && m.score_b != null ? (won ? "win" : "lose") : "";
    return (
      <div className={`pptv-tm ${cls}`}>
        <span className="pptv-pv">{pairAvatars(t, ids).map((a, i) => <Av key={i} url={a.url} name={a.name} />)}</span>
        <span className="nm">{names || "—"}</span>
      </div>
    );
  };

  return (
    <>
      {header && (
        <div className="pptv-head">
          <div className="pptv-logo">🏆</div>
          <div style={{ minWidth: 0 }}><div className="pptv-nm">{t.name || fmt.name}</div><div className="pptv-sub">{fmt.name}</div></div>
          <span className="pptv-live"><i />LIVE</span>
          <span className="pptv-clock">{clock}</span>
        </div>
      )}
      <div className="pptv-roundwrap">
        <span className="pptv-rlab">{tr("trn_tv_round").replace("{n}", String(round))}{rounds ? <> {tr("games_of")} <b>{rounds}</b></> : null}</span>
        <div className="pptv-dots">
          {Array.from({ length: Math.max(rounds, 1) }, (_, i) => (
            <i key={i} className={i + 1 < round ? "done" : i + 1 === round ? "now" : ""} />
          ))}
        </div>
      </div>
      <div className="pptv-tbody">
        {(() => {
          // Адаптив под число кортов (в турнире их может быть много: 100 игроков
          // ≈ 24 корта в раунде). Колонки и масштаб растут/падают; при переборе
          // показываем сколько влезает + «ещё N» (все игроки видны в таблице).
          const nC = courts.length;
          const MAX = 9;
          const shown = courts.slice(0, MAX);
          const cc = nC <= 1 ? 1 : nC <= 4 ? 2 : 3;
          const cs = nC <= 2 ? 1 : nC <= 4 ? 0.72 : nC <= 6 ? 0.56 : 0.46;
          return (
        <div className="pptv-courts" style={{ "--cc": cc, "--cs": cs }}>
          {shown.map((m) => (
            <div key={m.id} className="pptv-court live">
              <div className="pptv-clab"><i />{t.court_names?.[String(m.court)] || `${tr("court_label")} ${m.court}`}</div>
              <div className="pptv-lineup">{team(m, "a")}{team(m, "b")}</div>
              <div className="pptv-scoreline">
                <span className={`d ${m.score_a > m.score_b ? "win" : m.score_a < m.score_b ? "lose" : ""}`}>{m.score_a ?? 0}</span>
                <span className="sep">:</span>
                <span className={`d ${m.score_b > m.score_a ? "win" : m.score_b < m.score_a ? "lose" : ""}`}>{m.score_b ?? 0}</span>
              </div>
            </div>
          ))}
          {nC > MAX && <div className="pptv-morec">+{nC - MAX} {tr("court_label").toLowerCase()}…</div>}
        </div>
          );
        })()}
        <div className="pptv-tbl">
          <div className="pptv-tgrid pptv-thead"><span className="l">#</span><span className="l">{tr("trn_pairs")}</span><span>{tr("result_win")}·{tr("result_draw")}·{tr("result_loss")}</span><span>{tr("trn_hero_pts")}</span><span>Δ</span></div>
          {table.slice(0, 6).map((r, i) => (
            <div key={r.id || i} className={`pptv-tgrid pptv-trow${i === 0 ? " lead" : ""}`}>
              <span className="rk">{i + 1}</span>
              <span className="who">{r.name || (r.names || []).join(" & ")}</span>
              <span className="wdl">{r.wins ?? 0}·{r.draws ?? 0}·{r.losses ?? 0}</span>
              <span className="pt">{r.points}</span>
              <span className="dl" style={{ color: (r.delta || 0) > 0 ? "var(--accent)" : (r.delta || 0) < 0 ? "var(--live)" : "var(--mut)" }}>{(r.delta || 0) > 0 ? `+${r.delta}` : r.delta || 0}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function TvBoard({ code = null, initial = null, onClose = null }) {
  const [t, setT] = useState(initial);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [err, setErr] = useState(null);
  const loadedRef = useRef(!!initial);
  const clock = useTvClock();
  useWakeLock(true);
  useEffect(() => { if (initial) { loadedRef.current = true; setT(initial); } }, [initial]);
  useEffect(() => {
    if (!code || initial) return;
    let alive = true;
    const load = () => getTournamentByCode(code)
      .then((d) => { if (!alive) return; if (d) { loadedRef.current = true; setT(d); setFetchedAt(Date.now()); setErr(null); } else if (!loadedRef.current) setErr("notfound"); })
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
  if (!t) {
    if (err === "notfound") return <TvMessage text={tr("trn_tv_notfound")} onClose={onClose} />;
    if (err === "neterr") return <TvMessage text={tr("trn_tv_neterr")} onClose={onClose} />;
    return <TvMessage text={tr("loading")} onClose={onClose} />;
  }
  if (!(t.matches || []).length) return <TvMessage text={`🏆 ${t.name || fmt.name}\n${tr("trn_tv_notstarted")}`} onClose={onClose} />;
  return (
    <div className="pptv">
      <TvStyle />
      <TvBackdrop />
      {onClose && <button className="pptv-close" onClick={onClose}>✕</button>}
      <TvTournamentScreen t={t} clock={clock} header />
    </div>
  );
}
