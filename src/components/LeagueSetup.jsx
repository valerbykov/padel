import { useState } from "react";
import Logo from "./Logo";
import { createLeague, joinLeague } from "../lib/padelApi";
import { t } from "../lib/i18n";

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
      setErr(e.message || t("err_generic"));
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
      if (msg.includes("league_not_found")) setErr(t("err_league_not_found"));
      else if (msg.includes("already_member")) setErr(t("err_already_member"));
      else setErr(msg || t("err_generic"));
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
      background: "var(--lime)", color: "var(--lime-fg)", fontWeight: 700,
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
      <div style={{ marginBottom: 14 }}><Logo height={40} /></div>
      <div style={s.title}>{t("ls_welcome")}</div>
      <div style={s.sub}>
        {t("ls_welcome_sub")}
      </div>
      <div style={s.row}>
        <button style={s.btnPrimary}  onClick={() => setMode("create")}>{t("ls_create_league")}</button>
        <button style={s.btnSecondary} onClick={() => setMode("join")}>{t("ls_by_code")}</button>
      </div>
      {onCancel && (
        <button style={s.back} onClick={onCancel}>{t("ls_skip")}</button>
      )}
    </div>
  );

  /* ── создать лигу ───────────────────────────────────────────── */
  if (mode === "create") return (
    <div style={s.wrap}>
      <div style={s.logo}>🏆</div>
      <div style={s.title}>{t("ls_new_title")}</div>
      <div style={s.sub}>{t("ls_new_sub")}</div>
      <input
        style={s.input}
        placeholder={t("ls_name_ph")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        maxLength={60}
        autoFocus
      />
      {err && <div style={s.err}>{err}</div>}
      <div style={s.row}>
        <button style={s.btnPrimary} disabled={busy || !name.trim()} onClick={handleCreate}>
          {busy ? t("creating") : t("ls_create_btn")}
        </button>
      </div>
      <button style={s.back} onClick={() => { setMode(null); setErr(""); }}>{t("ls_back")}</button>
    </div>
  );

  /* ── вступить по коду ───────────────────────────────────────── */
  return (
    <div style={s.wrap}>
      <div style={s.logo}>🔑</div>
      <div style={s.title}>{t("ls_join_title")}</div>
      <div style={s.sub}>{t("ls_join_sub")}</div>
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
          {busy ? t("creating") : t("ls_join_btn")}
        </button>
      </div>
      <button style={s.back} onClick={() => { setMode(null); setErr(""); }}>{t("ls_back")}</button>
    </div>
  );
}
