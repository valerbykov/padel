import { useState } from "react";
import { createLeague, joinLeague } from "../lib/padelApi";

/**
 * Экран первичной настройки.
 * Показывается, когда у залогиненного пользователя нет ни одной лиги.
 * onDone(league) — вызывается после создания/присоединения.
 */
export default function LeagueSetup({ onDone, initialMode = null, initialCode = "", onCancel = null }) {
  const [mode, setMode]       = useState(initialMode); // "create" | "join" | null
  const [name, setName]       = useState("");
  const [code, setCode]       = useState(initialCode);
  const [busy, setBusy]       = useState(false);
  const [err,  setErr]        = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    setBusy(true); setErr("");
    try {
      const league = await createLeague(name.trim());
      onDone(league);
    } catch (e) {
      setErr(e.message || "Ошибка создания лиги");
    } finally { setBusy(false); }
  }

  async function handleJoin() {
    if (code.trim().length < 4) return;
    setBusy(true); setErr("");
    try {
      const league = await joinLeague(code.trim());
      onDone(league);
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("league_not_found")) setErr("Лига с таким кодом не найдена");
      else if (msg.includes("already_member")) setErr("Вы уже состоите в этой лиге");
      else setErr(msg || "Ошибка вступления");
    } finally { setBusy(false); }
  }

  /* ── стили ──────────────────────────────────────────────────── */
  const s = {
    wrap: {
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "80vh",
      padding: "32px 24px", gap: 24, textAlign: "center",
    },
    logo: { fontSize: 48, marginBottom: 4 },
    title: { fontSize: 22, fontWeight: 700, color: "var(--fg)" },
    sub: { fontSize: 14, color: "var(--mut)", maxWidth: 300, lineHeight: 1.5 },
    row: { display: "flex", gap: 12, width: "100%", maxWidth: 320 },
    btnPrimary: {
      flex: 1, padding: "12px 0", borderRadius: 12, border: "none",
      background: "var(--lime)", color: "#111", fontWeight: 700,
      fontSize: 15, cursor: "pointer",
    },
    btnSecondary: {
      flex: 1, padding: "12px 0", borderRadius: 12,
      border: "1px solid var(--border)", background: "none",
      color: "var(--fg)", fontSize: 15, cursor: "pointer",
    },
    input: {
      width: "100%", maxWidth: 320, padding: "12px 14px",
      borderRadius: 12, border: "1px solid var(--border)",
      background: "var(--card)", color: "var(--fg)", fontSize: 15,
      boxSizing: "border-box",
    },
    back: {
      fontSize: 13, color: "var(--mut)", cursor: "pointer",
      background: "none", border: "none", textDecoration: "underline",
    },
    err: { fontSize: 13, color: "var(--coral)" },
  };

  /* ── выбор режима ───────────────────────────────────────────── */
  if (!mode) return (
    <div style={s.wrap}>
      <div style={s.logo}>🎾</div>
      <div style={s.title}>Добро пожаловать!</div>
      <div style={s.sub}>
        Чтобы начать, создайте свою лигу или вступите в уже существующую по коду-приглашению.
      </div>
      <div style={s.row}>
        <button style={s.btnPrimary}  onClick={() => setMode("create")}>Создать лигу</button>
        <button style={s.btnSecondary} onClick={() => setMode("join")}>По коду</button>
      </div>
      {onCancel && (
        <button style={s.back} onClick={onCancel}>Пропустить →</button>
      )}
    </div>
  );

  /* ── создать лигу ───────────────────────────────────────────── */
  if (mode === "create") return (
    <div style={s.wrap}>
      <div style={s.logo}>🏆</div>
      <div style={s.title}>Новая лига</div>
      <div style={s.sub}>Придумайте название — его увидят все участники.</div>
      <input
        style={s.input}
        placeholder="Название лиги"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        maxLength={60}
        autoFocus
      />
      {err && <div style={s.err}>{err}</div>}
      <div style={s.row}>
        <button style={s.btnPrimary} disabled={busy || !name.trim()} onClick={handleCreate}>
          {busy ? "..." : "Создать"}
        </button>
      </div>
      <button style={s.back} onClick={() => { setMode(null); setErr(""); }}>← Назад</button>
    </div>
  );

  /* ── вступить по коду ───────────────────────────────────────── */
  return (
    <div style={s.wrap}>
      <div style={s.logo}>🔑</div>
      <div style={s.title}>Вступить в лигу</div>
      <div style={s.sub}>Введите код, который прислал организатор лиги.</div>
      <input
        style={{ ...s.input, textTransform: "uppercase", letterSpacing: 3, textAlign: "center" }}
        placeholder="XXXXXX"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
        onKeyDown={(e) => e.key === "Enter" && handleJoin()}
        maxLength={6}
        autoFocus
      />
      {err && <div style={s.err}>{err}</div>}
      <div style={s.row}>
        <button style={s.btnPrimary} disabled={busy || code.trim().length < 4} onClick={handleJoin}>
          {busy ? "..." : "Вступить"}
        </button>
      </div>
      <button style={s.back} onClick={() => { setMode(null); setErr(""); }}>← Назад</button>
    </div>
  );
}
