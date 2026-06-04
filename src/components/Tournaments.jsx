// components/Tournaments.jsx
// Турниры Американо: создание, лобби с приглашением по ссылке, раунды
// со вводом счёта и итоговая таблица. props: { groupId, players }.
import React, { useEffect, useState, useCallback } from "react";
import {
  createTournament, listTournaments, getTournament, addTournamentPlayer, removeTournamentPlayer,
  startTournament, submitMatchScore, finishTournament, tournamentLink,
} from "../lib/tournamentApi";
import { standings, allMatchesPlayed } from "../lib/americano";
import { Trophy, PlusCircle, Share2, Copy, Play, X, ArrowLeft, RefreshCw, Users } from "lucide-react";

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

  if (mode === "create")
    return <Create groupId={groupId} back={() => setMode("list")} open={(id) => { setActiveId(id); setMode("view"); }} />;
  if (mode === "view")
    return <TournamentView id={activeId} players={players} back={() => setMode("list")} />;
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
            <option value={4}>4 (1 корт)</option>
            <option value={8}>8 (2 корта)</option>
            <option value={12}>12 (3 корта)</option>
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

function TournamentView({ id, players, back }) {
  const [t, setT] = useState(null);
  const [adding, setAdding] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => { try { setT(await getTournament(id)); } catch (e) { setT(false); } }, [id]);
  useEffect(() => { load(); }, [load]);

  if (t === null) return <div className="tr-root"><style>{css}</style><div className="tr-card" style={{ textAlign: "center", color: "var(--mut)" }}>Загрузка…</div></div>;
  if (t === false) return <div className="tr-root"><style>{css}</style><div className="tr-card" style={{ color: "var(--coral)" }}>Не удалось загрузить турнир.</div></div>;

  const nameOf = (tpId) => (t.players.find((p) => p.id === tpId)?.name) || "?";
  const table = standings(t.players.map((p) => ({ id: p.id, name: p.name })), t.matches);
  const done = allMatchesPlayed(t.matches);

  const share = async () => {
    const url = tournamentLink(t.invite_code);
    const text = `Зову на турнир по паделю${t.name ? ` «${t.name}»` : ""}! Присоединяйся: ${url} (код ${t.invite_code})`;
    try { if (navigator.share) { await navigator.share({ title: "Турнир", text, url }); return; } } catch (e) {}
    try { await navigator.clipboard.writeText(text); setToast("Скопировано ✓"); setTimeout(() => setToast(""), 1500); } catch (e) {}
  };
  const addFromRoster = async () => {
    if (!adding) return;
    const p = players.find((x) => x.id === adding);
    try { await addTournamentPlayer(t.id, { profileId: p.id, name: p.name }); setAdding(""); load(); } catch (e) { alert("Не удалось добавить"); }
  };
  const start = async () => {
    try { await startTournament(t.id, t.players); load(); } catch (e) { alert(e.message || "Не удалось запустить"); }
  };
  const saveScore = async (matchId, a, b) => { await submitMatchScore(matchId, a, b); await load(); };
  const finishIfDone = async () => { if (done && t.status !== "finished") { await finishTournament(t.id); load(); } };

  // раунды
  const rounds = {};
  t.matches.forEach((m) => { (rounds[m.round_number] = rounds[m.round_number] || []).push(m); });
  const roundNums = Object.keys(rounds).map(Number).sort((a, b) => a - b);

  return (
    <div className="tr-root">
      <style>{css}</style>
      <button className="tr-ghost" style={{ padding: "6px 12px", marginBottom: 12 }} onClick={back}><ArrowLeft size={14} /> К списку</button>

      <div className="tr-card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="tr-d" style={{ fontSize: 20 }}>{t.name || "Американо"}</div>
          <button className="tr-ghost" style={{ padding: 8 }} onClick={load}><RefreshCw size={15} /></button>
        </div>
        <div style={{ fontSize: 12, color: "var(--mut)" }}>{t.players.length}/{t.target_size} игроков · до {t.points_per_game} очков · {statusLabel[t.status]}</div>
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
                <Users size={14} color="var(--mut)" />
                <span style={{ flex: 1 }}>{p.name}</span>
                <button className="tr-ghost" style={{ padding: 4, border: "none", background: "none", color: "var(--mut)" }} onClick={async () => { await removeTournamentPlayer(p.id); load(); }}><X size={14} /></button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <select className="tr-select" value={adding} onChange={(e) => setAdding(e.target.value)}>
                <option value="">+ добавить из состава</option>
                {players.filter((p) => !t.players.some((tp) => tp.profile_id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="tr-btn" style={{ padding: "0 16px" }} onClick={addFromRoster}>OK</button>
            </div>
          </div>

          <button className="tr-btn" style={{ width: "100%", padding: 14, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            disabled={t.players.length < 4 || t.players.length % 4 !== 0}
            onClick={start}>
            <Play size={18} /> Запустить турнир ({t.players.length})
          </button>
          {t.players.length % 4 !== 0 && <div style={{ textAlign: "center", color: "var(--coral)", fontSize: 12, marginTop: 8 }}>Нужно число игроков, кратное 4</div>}
        </>
      )}

      {/* АКТИВНЫЙ / ЗАВЕРШЁН */}
      {t.status !== "open" && (
        <>
          <div className="tr-card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="tr-d" style={{ fontSize: 16 }}>{done ? "🏆 Итоговая таблица" : "Таблица"}</div>
            </div>
            {table.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                <span className="tr-d" style={{ width: 22, color: ["#ffd23f", "#cfd8d0", "#cd7f4d"][i] || "var(--mut)" }}>{i + 1}</span>
                <span style={{ flex: 1, fontWeight: i === 0 && done ? 700 : 500 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: "var(--mut)" }}>{p.played} игр</span>
                <span className="tr-d" style={{ color: "var(--lime)", minWidth: 36, textAlign: "right" }}>{p.points}</span>
              </div>
            ))}
            {done && t.status !== "finished" && (
              <button className="tr-btn" style={{ width: "100%", padding: 11, marginTop: 12 }} onClick={finishIfDone}>Завершить турнир</button>
            )}
          </div>

          {roundNums.map((rn) => (
            <div key={rn} className="tr-card" style={{ marginBottom: 10 }}>
              <div className="tr-d" style={{ fontSize: 13, color: "var(--mut)", marginBottom: 8 }}>Раунд {rn}</div>
              {rounds[rn].sort((a, b) => a.court - b.court).map((m) => (
                <MatchRow key={m.id} m={m} points={t.points_per_game} nameOf={nameOf} onSave={saveScore} locked={t.status === "finished"} />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function MatchRow({ m, points, nameOf, onSave, locked }) {
  const [a, setA] = useState(m.score_a ?? "");
  const [busy, setBusy] = useState(false);
  const played = m.score_a != null;
  const aNum = a === "" ? null : Math.max(0, Math.min(points, Number(a)));
  const bNum = aNum == null ? null : points - aNum;

  const save = async () => {
    if (aNum == null) return;
    setBusy(true);
    try { await onSave(m.id, aNum, bNum); } finally { setBusy(false); }
  };

  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
      <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 4 }}>Корт {m.court}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, fontSize: 13 }}>{nameOf(m.team_a[0])} / {nameOf(m.team_a[1])}</span>
        {locked || played ? (
          <span className="tr-d" style={{ fontSize: 16 }}>{m.score_a} : {m.score_b}</span>
        ) : (
          <>
            <input className="tr-input" style={{ width: 54, textAlign: "center", padding: "6px" }} type="number" min={0} max={points} value={a}
              onChange={(e) => setA(e.target.value)} placeholder="0" />
            <span style={{ color: "var(--mut)" }}>:</span>
            <span className="tr-d" style={{ width: 30, textAlign: "center" }}>{bNum ?? "—"}</span>
          </>
        )}
        <span style={{ flex: 1, fontSize: 13, textAlign: "right" }}>{nameOf(m.team_b[0])} / {nameOf(m.team_b[1])}</span>
      </div>
      {!locked && !played && (
        <button className="tr-btn" style={{ width: "100%", padding: 7, marginTop: 6, fontSize: 13 }} disabled={aNum == null || busy} onClick={save}>
          {busy ? "…" : "Сохранить счёт"}
        </button>
      )}
    </div>
  );
}
