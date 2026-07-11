// components/LeagueManager.jsx
// Окно «ведения» лиги: фирменный логотип, организатор, телеграм-канал,
// код приглашения. Админ/владелец редактирует, участник — только смотрит.
// Данные тянет через get_league_details (RPC), сохраняет в groups (RLS).
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Upload, Send, Check, Star, Users, ShieldCheck, ChevronDown, Loader, UserPlus, Swords, LogOut, Trash2 } from "lucide-react";
import { getLeagueDetails, updateLeague, uploadLeagueLogo, leaveLeague, deleteLeague } from "../lib/padelApi";
import Avatar from "./Avatar";
import InviteCard from "./InviteCard";
import { t } from "../lib/i18n";

function Section({ icon, title, count, open, onToggle, children }) {
  return (
    <div style={{ marginBottom: 12, border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", background: "var(--surface2)" }}>
      <button onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 12px", background: "none", border: "none", cursor: "pointer", color: "var(--ink)", fontFamily: "'Outfit',sans-serif", textAlign: "left" }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
        {count != null && <span style={{ fontSize: 12, color: "var(--mut)", fontWeight: 600 }}>· {count}</span>}
        <ChevronDown size={16} style={{ marginLeft: "auto", color: "var(--mut)", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && <div style={{ padding: "0 12px 12px" }}>{children}</div>}
    </div>
  );
}

// Подтверждение опасного действия — поверх шторки (её корень уже в портале,
// трансформов нет, так что fixed здесь честно центрируется во вьюпорте).
function DangerConfirm({ title, sub, btn, busy, onConfirm, onCancel }) {
  return (
    <div onClick={busy ? undefined : onCancel} style={{ position: "fixed", inset: 0, zIndex: 320, background: "rgba(0,0,0,.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: "var(--ink)" }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 16, lineHeight: 1.45 }}>{sub}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} disabled={busy} style={{ flex: 1, padding: 11, background: "var(--surface2)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 12, cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontSize: 14 }}>{t("cancel")}</button>
          <button onClick={onConfirm} disabled={busy} style={{ flex: 1, padding: 11, border: "none", borderRadius: 12, background: "var(--coral)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Outfit',sans-serif", opacity: busy ? .6 : 1 }}>
            {busy ? t("deleting") : btn}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeagueManager({ groupId, role = "member", canEdit = false, isDemo = false, onClose, onUpdated, onLeft }) {
  const [d, setD] = useState(null);          // детали из RPC
  const [name, setName] = useState("");
  const [tg, setTg] = useState("");
  const [logo, setLogo] = useState("");
  const [membersCanAdd, setMembersCanAdd] = useState(false); // #1: кто добавляет игроков
  const [membersCanCreate, setMembersCanCreate] = useState(false); // #1: кто создаёт игры/турниры
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const [openTeam, setOpenTeam] = useState(false);
  const [danger, setDanger] = useState(false);       // подтверждение выхода/удаления
  const [dangerBusy, setDangerBusy] = useState(false);
  const isOwner = role === "owner";

  // Владелец удаляет лигу целиком, остальные (организатор/участник) — выходят.
  const doDanger = async () => {
    if (dangerBusy) return;
    setDangerBusy(true); setErr("");
    try {
      if (isOwner) await deleteLeague(groupId);
      else await leaveLeague(groupId);
      onLeft && onLeft(groupId);
      onClose && onClose();
    } catch (e) {
      setErr(e.message || t("err_generic"));
      setDanger(false); setDangerBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const det = await getLeagueDetails(groupId);
        if (!alive) return;
        setD(det); setName(det.name || ""); setTg(det.telegram_url || ""); setLogo(det.logo_url || ""); setMembersCanAdd(!!det.members_can_add); setMembersCanCreate(!!det.members_can_create);
      } catch (e) { if (alive) setErr(e.message || t("err_generic")); }
    })();
    return () => { alive = false; };
  }, [groupId]);

  const dirty = d && (
    name.trim() !== (d.name || "") ||
    (tg.trim() || "") !== (d.telegram_url || "") ||
    (logo || "") !== (d.logo_url || "") ||
    (!!membersCanAdd) !== (!!d.members_can_add) ||
    (!!membersCanCreate) !== (!!d.members_can_create)
  );

  const onPick = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true); setErr("");
    try { setLogo(await uploadLeagueLogo(groupId, f)); }
    catch (er) { setErr(er.message || t("err_generic")); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const save = async () => {
    if (!canEdit || busy || !dirty) return;
    setBusy(true); setErr(""); setSaved(false);
    try {
      const upd = await updateLeague(groupId, { name, telegram_url: tg, logo_url: logo, members_can_add: membersCanAdd, members_can_create: membersCanCreate });
      setD((p) => ({ ...p, ...upd }));
      setSaved(true);
      onUpdated && onUpdated(upd);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) { setErr(e.message || t("err_generic")); }
    finally { setBusy(false); }
  };

  // Автосохранение (единый паттерн с личным кабинетом): дебаунс после правок,
  // хвост дебаунса не теряется при закрытии шторки.
  const saveTmRef = useRef(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!d || !canEdit || !dirty) return;
    clearTimeout(saveTmRef.current);
    saveTmRef.current = setTimeout(() => saveRef.current(), 800);
    return () => clearTimeout(saveTmRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, tg, logo, membersCanAdd, membersCanCreate]);
  const handleClose = () => {
    clearTimeout(saveTmRef.current);
    if (dirty && canEdit) saveRef.current();
    onClose && onClose();
  };


  const org = d?.organizer || {};
  const initial = (name.trim()[0] || "?").toUpperCase();
  const inp = { width: "100%", boxSizing: "border-box", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)", fontFamily: "'Outfit',sans-serif", outline: "none" };

  // Портал в body: иначе fixed-оверлей попадает в трансформируемого предка
  // (.pl-pop с анимацией) и «уезжает» вместе с нижней навигацией.
  return createPortal(
    <div onClick={handleClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: "'Outfit',sans-serif" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "20px 20px 0 0", padding: 18, paddingBottom: "max(18px, env(safe-area-inset-bottom))", boxShadow: "0 -8px 40px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)" }}>{t("league_manage")}</div>
          <span aria-live="polite" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--mut)", whiteSpace: "nowrap" }}>
            {busy && <><Loader size={12} /> {t("league_saving")}</>}
            {!busy && saved && <><Check size={13} style={{ color: "var(--lime)" }} /> {t("pc_saved").toLowerCase()}</>}
          </span>
          <button onClick={handleClose} aria-label="✕" style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--mut)", cursor: "pointer", padding: 6, display: "flex", flexShrink: 0 }}><X size={16} /></button>
        </div>

        {!d && !err && <div style={{ color: "var(--mut)", fontSize: 13, padding: "24px 0", textAlign: "center" }}>…</div>}
        {err && <div style={{ color: "var(--coral)", fontSize: 13, marginBottom: 12 }}>{err}</div>}

        {d && (
          <>
            {/* Логотип + название */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 72, height: 72, borderRadius: 18, overflow: "hidden", background: "color-mix(in srgb,var(--lime) 14%,transparent)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {logo ? <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontWeight: 800, fontSize: 28, color: "var(--lime)" }}>{initial}</span>}
                </div>
                {canEdit && (
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} title={t("league_logo_upload")}
                    style={{ position: "absolute", right: -6, bottom: -6, width: 28, height: 28, borderRadius: "50%", background: "var(--lime)", color: "var(--lime-fg)", border: "2px solid var(--surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {uploading ? <span style={{ fontSize: 11 }}>…</span> : <Upload size={13} />}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 5 }}>{t("league_name_label")}</div>
                {canEdit
                  ? <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...inp, fontSize: 16, padding: "9px 12px" }} />
                  : <div style={{ fontWeight: 700, fontSize: 18, color: "var(--ink)" }}>{name}</div>}
                {canEdit && logo && (
                  <button onClick={() => setLogo("")} style={{ marginTop: 8, background: "none", border: "none", color: "var(--mut)", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "'Outfit',sans-serif" }}>{t("league_logo_remove")}</button>
                )}
              </div>
            </div>

            {/* Команда: владелец + организаторы (сворачивается) */}
            <Section icon={<Users size={13} style={{ color: "var(--mut)" }} />} title={t("league_team")}
              count={Array.isArray(d.organizers) && d.organizers.length ? 1 + d.organizers.length : null}
              open={openTeam} onToggle={() => setOpenTeam((v) => !v)}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginBottom: (Array.isArray(d.organizers) && d.organizers.length) ? 6 : 0 }}>
                <Avatar url={org.avatar_url} name={org.name} size={34} />
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{org.name || "—"}</div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: "var(--mut)", fontWeight: 600 }}>{t("role_owner")}</span>
                  <Star size={16} style={{ color: "var(--yellow)" }} />
                </div>
              </div>
              {Array.isArray(d.organizers) && d.organizers.map((o, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginBottom: 6 }}>
                  <Avatar url={o.avatar_url} name={o.name} size={30} />
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{o.name}</div>
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: "var(--mut)", fontWeight: 600 }}>{t("role_organizer")}</span>
                    <ShieldCheck size={14} style={{ color: "var(--yellow)" }} />
                  </div>
                </div>
              ))}
            </Section>

            {/* Инвайт-карта — общий компонент с вкладкой «Друзья»: код + ссылка + QR.
                #4: только тем, кто может приглашать. В демо-песочницу не приглашают. */}
            {d.invite_code && !isDemo && (canEdit || membersCanAdd) && (
              <InviteCard code={d.invite_code} leagueName={name} style={{ marginBottom: 12 }} />
            )}

            {/* Телеграм-канал — строка с иконкой-чипом, единый стиль с кабинетом */}
            <div style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 14, padding: "11px 12px", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(34,158,217,.16)", color: "#4db8e8" }}><Send size={15} /></span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", flexShrink: 0 }}>{t("league_telegram")}</span>
                {!canEdit && (tg
                  ? <a href={tg} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", color: "var(--lime)", fontSize: 12.5, textDecoration: "none", fontWeight: 600 }}>{t("league_open_channel")} →</a>
                  : <span style={{ marginLeft: "auto", color: "var(--mut)", fontSize: 13 }}>—</span>)}
              </div>
              {canEdit && (
                <>
                  <input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="https://t.me/..." inputMode="url" style={{ ...inp, fontSize: 14, padding: "9px 12px", marginTop: 9 }} />
                  <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 5 }}>{t("league_telegram_hint")}</div>
                </>
              )}
            </div>

            {/* Права участников — строки с иконками и тумблерами */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mut)", letterSpacing: .3, textTransform: "uppercase", margin: "2px 2px 6px" }}>{t("league_rights_title")}</div>
            <div style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 14, marginBottom: 12, opacity: canEdit ? 1 : 0.72 }}>
              <div onClick={canEdit ? () => setMembersCanAdd((v) => !v) : undefined} role="switch" aria-checked={membersCanAdd} aria-disabled={!canEdit}
                style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", borderBottom: "1px solid var(--line)", cursor: canEdit ? "pointer" : "default" }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--lime) 13%, transparent)", color: "var(--lime)" }}><UserPlus size={15} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t("members_can_add_label")}</div>
                  <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 1, lineHeight: 1.35 }}>{t("members_can_add_hint")}</div>
                </div>
                <div style={{ flexShrink: 0, width: 42, height: 24, borderRadius: 999, background: membersCanAdd ? "var(--lime)" : "var(--line)", position: "relative", transition: "background .15s" }}>
                  <span style={{ position: "absolute", top: 3, left: membersCanAdd ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                </div>
              </div>
              <div onClick={canEdit ? () => setMembersCanCreate((v) => !v) : undefined} role="switch" aria-checked={membersCanCreate} aria-disabled={!canEdit}
                style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", cursor: canEdit ? "pointer" : "default" }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--yellow) 13%, transparent)", color: "var(--yellow)" }}><Swords size={15} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t("members_can_create_label")}</div>
                  <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 1, lineHeight: 1.35 }}>{t("members_can_create_hint")}</div>
                </div>
                <div style={{ flexShrink: 0, width: 42, height: 24, borderRadius: 999, background: membersCanCreate ? "var(--lime)" : "var(--line)", position: "relative", transition: "background .15s" }}>
                  <span style={{ position: "absolute", top: 3, left: membersCanCreate ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                </div>
              </div>
            </div>

            {!canEdit && (
              <div style={{ textAlign: "center", fontSize: 12, color: "var(--mut)", padding: "2px 0 4px" }}>{t("league_view_only")}</div>
            )}

            {/* Опасная зона: владелец удаляет лигу, остальные — выходят из неё */}
            <div style={{ background: "var(--surface2)", border: "1px solid color-mix(in srgb, var(--coral) 35%, var(--line))", borderRadius: 14, marginTop: 6 }}>
              <div onClick={() => setDanger(true)} role="button"
                style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", cursor: "pointer" }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--coral) 14%, transparent)", color: "var(--coral)" }}>
                  {isOwner ? <Trash2 size={15} /> : <LogOut size={15} />}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--coral)" }}>{isOwner ? t("lg_delete") : t("lg_leave")}</div>
                  <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 1, lineHeight: 1.35 }}>{isOwner ? t("lg_delete_hint") : t("lg_leave_hint")}</div>
                </div>
              </div>
            </div>
          </>
        )}

        {danger && (
          <DangerConfirm
            title={`${isOwner ? t("lg_delete") : t("lg_leave")}: ${name || ""}?`}
            sub={isOwner ? t("lg_delete_sub") : t("lg_leave_sub")}
            btn={isOwner ? t("lg_delete_btn") : t("lg_leave_btn")}
            busy={dangerBusy}
            onConfirm={doDanger}
            onCancel={() => setDanger(false)}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
