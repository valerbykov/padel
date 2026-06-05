// components/Tournaments.jsx
// Турниры Американо: создание, лобби с приглашением, ПОСЛЕДОВАТЕЛЬНЫЕ раунды
// на кортах (CourtView), итоговая таблица. props: { groupId, players }.
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  createTournament, listTournaments, getTournament, addTournamentPlayer, removeTournamentPlayer,
  startTournament, submitMatchScore, finishTournament, tournamentLink,
} from "../lib/tournamentApi";
import { standings, detailedStandings, allMatchesPlayed } from "../lib/americano";
import CourtView from "./CourtView";
import { Trophy, PlusCircle, Copy, Play, X, ArrowLeft, RefreshCw, Users, ChevronLeft, ChevronRight, Share2 } from "lucide-react";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.tr-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;font-family:'Outfit',sans-serif;color:var(--ink);}
.tr-d{font-family:'Anton',sans-serif;text-transform:uppercase;letter-spacing:.5px;}
.tr-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px;}
.tr-btn{background:var(--lime);color:#0a1612;font-weight:700;border:none;border-radius:14px;cursor:pointer;}
.tr-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
.tr-ghost{background:var(--surface2);color:var(--ink);border:1px solid var(--line);border-radius:14px;cursor:pointer;}
.tr-input,.tr-select{background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);font-family:'Outfit';outline:none;width:100%;padding:10px 12px;box-sizing:border-box;}
.tr-codebox{font-family:'Anton';letter-spacing:6px;font-size:28px;color:var(--lime);text-align:center;background:var(--surface2);border:1px dashed var(--line);border-radius:14px;padding:10px;}
.tr-badge{font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;}
`;
const statusLabel = { open: "набор", active: "идёт", finished: "завершён" };

export default function Tournaments({ groupId, players }) {
  const [mode, setMode] = useState("list");
  const [activeId, setActiveId] = useState(null);
  if (mode === "create") return <Create groupId={groupId} back={() => setMode("list")} open={(id) => { setActiveId(id); setMode("view"); }} />;
  if (mode === "view") return <TournamentView id={activeId} players={players} back={() => setMode("list")} />;
  return <List groupId={groupId} create={() => setMode("create")} open={(id) => { setActiveId(id); setMode("view"); }} />;
}

function List({ groupId, create, open }) {
  const [items, setItems] = useState(null);
  useEffect(() => { listTournaments(groupId).then(setItems).catch(() => setItems([])); }, [groupId]);
  return (
    <div className="tr-root">
      <style>{css}</style>
      <button className="tr-btn" style={{ width: "100%", padding: 13, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={create}>
        <PlusCircle size={18} /> Создать турнир
      </button>
      {items === null && <div className="tr-card" style={{ textAlign: "center", color: "var(--mut)" }}>Загрузка…</div>}
      {items && items.length === 0 && <div className="tr-card" style={{ textAlign: "center", color: "var(--mut)" }}>Турниров пока нет.</div>}
      {items && items.map((t) => {
        const c = { open: "var(--lime)", active: "#ffd23f", finished: "var(--mut)" }[t.status];
        return (
          <div key={t.id} className="tr-card" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => open(t.id)}>
            <Trophy size={20} color={c} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{t.name || "Американо"}</div>
              <div style={{ fontSize: 12, color: "var(--mut)" }}>{(t.players || []).length} игроков · до {t.points_per_game}</div>
            </div>
            <span className="tr-badge" style={{ background: "rgba(255,255,255,.06)", color: c }}>{statusLabel[t.status]}</span>
          </div>
        );
      })}
    </div>
  );
}

function Create({ groupId, back, open }) {
  const [name, setName] = useState(""), [points, setPoints] = useState(32), [size, setSize] = useState(8), [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { const t = await createTournament(groupId, { name, pointsPerGame: Number(points), targetSize: Number(size) }); open(t.id); }
    catch (e) { alert("Не удалось создать турнир"); setBusy(false); }
  };
  return (
    <div className="tr-root">
      <style>{css}</style>
      <button className="tr-ghost" style={{ padding: "6px 12px", marginBottom: 12 }} onClick={back}><ArrowLeft size={14} /> Назад</button>
      <div className="tr-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="tr-d" style={{ fontSize: 20 }}>Новый турнир</div>
        <input className="tr-input" placeholder="Название: «Американо в субботу»" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>Игроков</div>
          <select className="tr-select" value={size} onChange={(e) => setSize(e.target.value)}>
            <option value={4}>4 (1 корт)</option><option value={8}>8 (2 корта)</option><option value={12}>12 (3 корта)</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>Очков в игре</div>
          <input className="tr-input" type="number" min={8} max={64} value={points} onChange={(e) => setPoints(e.target.value)} />
        </div>
        <button className="tr-btn" style={{ padding: 13 }} disabled={busy} onClick={go}>{busy ? "Создаю…" : "Создать"}</button>
      </div>
    </div>
  );
}

function groupRounds(matches) {
  const r = {};
  matches.forEach((m) => { (r[m.round_number] = r[m.round_number] || []).push(m); });
  return r;
}

function AddPlayer({ players, existing, onAdd, disabled }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const existingIds = (existing || []).filter((p) => p.profile_id).map((p) => p.profile_id);
  const matches = q.trim()
    ? players.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()) && !existingIds.includes(p.id)).slice(0, 5)
    : [];
  const add = async (entry) => { setBusy(true); try { await onAdd(entry); setQ(""); } finally { setBusy(false); } };

  if (disabled) return <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 10 }}>Набрано максимум игроков.</div>;
  return (
    <div style={{ marginTop: 10 }}>
      <input className="tr-input" placeholder="Имя / поиск — игрок или гость" value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim() && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {matches.map((p) => (
            <button key={p.id} className="tr-ghost" disabled={busy} style={{ padding: "8px 10px", textAlign: "left" }} onClick={() => add({ profileId: p.id, name: p.name })}>{p.name}</button>
          ))}
          <button className="tr-btn" disabled={busy} style={{ padding: "8px 10px", textAlign: "left" }} onClick={() => add({ name: q.trim() })}>+ Гость: {q.trim()}</button>
        </div>
      )}
    </div>
  );
}

function TournamentView({ id, players, back }) {
  const [t, setT] = useState(null);
  const [toast, setToast] = useState("");
  const [cur, setCur] = useState(1);
  const initRef = useRef(false);

  const load = useCallback(async () => { try { setT(await getTournament(id)); } catch (e) { setT(false); } }, [id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!t || t.status === "open" || initRef.current) return;
    const rmap = groupRounds(t.matches);
    const nums = Object.keys(rmap).map(Number).sort((a, b) => a - b);
    const firstUnplayed = nums.find((n) => rmap[n].some((m) => m.score_a == null));
    setCur(firstUnplayed || nums[nums.length - 1] || 1);
    initRef.current = true;
  }, [t]);

  if (t === null) return <div className="tr-root"><style>{css}</style><div className="tr-card" style={{ textAlign: "center", color: "var(--mut)" }}>Загрузка…</div></div>;
  if (t === false) return <div className="tr-root"><style>{css}</style><div className="tr-card" style={{ color: "var(--coral)" }}>Не удалось загрузить турнир.</div></div>;

  const nameOf = (tpId) => (t.players.find((p) => p.id === tpId)?.name) || "?";
  const table = detailedStandings(t.players.map((p) => ({ id: p.id, name: p.name })), t.matches);
  const done = allMatchesPlayed(t.matches);
  const rmap = groupRounds(t.matches);
  const roundNums = Object.keys(rmap).map(Number).sort((a, b) => a - b);
  const N = roundNums.length;
  const curMatches = (rmap[cur] || []).sort((a, b) => a.court - b.court);
  const curComplete = curMatches.length > 0 && curMatches.every((m) => m.score_a != null);

  const share = async () => {
    const url = tournamentLink(t.invite_code);
    const text = `Турнир по паделю${t.name ? ` «${t.name}»` : ""}: ${url} (код ${t.invite_code})`;
    try { if (navigator.share) { await navigator.share({ title: "Турнир", text, url }); return; } } catch (e) {}
    try { await navigator.clipboard.writeText(text); setToast("Скопировано ✓"); setTimeout(() => setToast(""), 1500); } catch (e) {}
  };
  const start = async () => { try { await startTournament(t.id, t.players); load(); } catch (e) { alert(e.message || "Не удалось запустить"); } };
  const saveScore = async (matchId, a, b) => { await submitMatchScore(matchId, a, b); await load(); };

  return (
    <div className="tr-root">
      <style>{css}</style>
      <button className="tr-ghost" style={{ padding: "6px 12px", marginBottom: 12 }} onClick={back}><ArrowLeft size={14} /> К списку</button>

      <div className="tr-card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="tr-d" style={{ fontSize: 20 }}>{t.name || "Американо"}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="tr-ghost" style={{ padding: 8 }} onClick={load}><RefreshCw size={15} /></button>
            <button className="tr-btn" style={{ padding: "8px 12px", display: "flex", gap: 6, alignItems: "center" }} onClick={share}><Share2 size={14} /> {toast || "Ссылка"}</button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 2 }}>{t.players.length}/{t.target_size} игроков · до {t.points_per_game} очков · {statusLabel[t.status]}</div>
      </div>

      {/* ЛОББИ */}
      {t.status === "open" && (
        <>
          <div className="tr-card" style={{ marginBottom: 12 }}>
            <div className="tr-codebox">{t.invite_code}</div>
            <div style={{ fontSize: 12, color: "var(--mut)", margin: "8px 0", wordBreak: "break-all" }}>{tournamentLink(t.invite_code)}</div>
            <button className="tr-btn" style={{ width: "100%", padding: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={share}>
              <Copy size={15} /> {toast || "Поделиться приглашением"}
            </button>
          </div>
          <div className="tr-card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>Участники</div>
            {t.players.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <Users size={14} color="var(--mut)" /><span style={{ flex: 1 }}>{p.name}</span>
                <button style={{ padding: 4, border: "none", background: "none", color: "var(--mut)", cursor: "pointer" }} onClick={async () => { await removeTournamentPlayer(p.id); load(); }}><X size={14} /></button>
              </div>
            ))}
            <AddPlayer players={players} existing={t.players} disabled={t.players.length >= t.target_size}
              onAdd={async (entry) => { await addTournamentPlayer(t.id, entry); load(); }} />
          </div>
          <button className="tr-btn" style={{ width: "100%", padding: 14, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            disabled={t.players.length < 4 || t.players.length % 4 !== 0} onClick={start}>
            <Play size={18} /> Запустить турнир ({t.players.length})
          </button>
          {t.players.length % 4 !== 0 && <div style={{ textAlign: "center", color: "var(--coral)", fontSize: 12, marginTop: 8 }}>Нужно число игроков, кратное 4</div>}
        </>
      )}

      {/* АКТИВНЫЙ / ЗАВЕРШЁН — раунды по одному */}
      {t.status !== "open" && (
        <>
          <div className="tr-card" style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button className="tr-ghost" style={{ padding: 8, opacity: cur > 1 ? 1 : .4 }} disabled={cur <= 1} onClick={() => setCur(cur - 1)}><ChevronLeft size={18} /></button>
            <div className="tr-d" style={{ fontSize: 18 }}>Раунд {cur} <span style={{ color: "var(--mut)", fontSize: 14 }}>/ {N}</span></div>
            <button className="tr-ghost" style={{ padding: 8, opacity: curComplete && cur < N ? 1 : .4 }} disabled={!curComplete || cur >= N} onClick={() => setCur(cur + 1)}><ChevronRight size={18} /></button>
          </div>

          {curMatches.map((m) => (
            <CourtView key={m.id} courtNumber={m.court} points={t.points_per_game}
              teamA={[nameOf(m.team_a[0]), nameOf(m.team_a[1])]} teamB={[nameOf(m.team_b[0]), nameOf(m.team_b[1])]}
              scoreA={m.score_a} scoreB={m.score_b} editable={t.status !== "finished"}
              onSave={(a, b) => saveScore(m.id, a, b)} />
          ))}

          {!curComplete && <div style={{ textAlign: "center", color: "var(--mut)", fontSize: 12, marginBottom: 12 }}>Заполни счёт всех кортов, чтобы перейти к следующему раунду.</div>}
          {curComplete && cur < N && <button className="tr-btn" style={{ width: "100%", padding: 12, marginBottom: 12 }} onClick={() => setCur(cur + 1)}>Следующий раунд →</button>}
          {done && t.status !== "finished" && <button className="tr-btn" style={{ width: "100%", padding: 13, marginBottom: 12 }} onClick={async () => { await finishTournament(t.id); load(); }}>Завершить турнир</button>}

          <div className="tr-card">
            <div className="tr-d" style={{ fontSize: 15, marginBottom: 2 }}>{done ? "🏆 Итоговая таблица" : "Таблица"}</div>
            <div style={{ fontSize: 10, color: "var(--mut)", marginBottom: 8 }}>побед–ничьих–поражений · очки за/против · Δ дельта</div>
            {table.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <span className="tr-d" style={{ width: 22, color: ["#ffd23f", "#cfd8d0", "#cd7f4d"][i] || "var(--mut)" }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: i === 0 && done ? 700 : 500 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--mut)" }}>{p.wins}–{p.draws}–{p.losses} · +{p.points}/−{p.against} · Δ{p.delta >= 0 ? "+" : ""}{p.delta}</div>
                </div>
                <span className="tr-d" style={{ color: "var(--lime)", minWidth: 36, textAlign: "right" }}>{p.points}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
