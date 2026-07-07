// components/LeagueManager.jsx
// Окно «ведения» лиги: фирменный логотип, организатор, телеграм-канал,
// код приглашения. Админ/владелец редактирует, участник — только смотрит.
// Данные тянет через get_league_details (RPC), сохраняет в groups (RLS).
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Upload, Send, Copy, Check, Crown, ShieldCheck, Megaphone, ChevronDown } from "lucide-react";
import { getLeagueDetails, updateLeague, uploadLeagueLogo, postLeagueAnnouncement, listLeaguePosts, deleteLeaguePost } from "../lib/padelApi";
import Avatar from "./Avatar";
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

export default function LeagueManager({ groupId, canEdit = false, onClose, onUpdated }) {
  const [d, setD] = useState(null);          // детали из RPC
  const [name, setName] = useState("");
  const [tg, setTg] = useState("");
  const [logo, setLogo] = useState("");
  const [membersCanAdd, setMembersCanAdd] = useState(false); // #1: кто добавляет игроков
  const [membersCanCreate, setMembersCanCreate] = useState(false); // #1: кто создаёт игры/турниры
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  // Объявления лиги (league_posts): композер — владельцу/организатору, список — всем.
  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [openTeam, setOpenTeam] = useState(false);
  const [openPosts, setOpenPosts] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const det = await getLeagueDetails(groupId);
        if (!alive) return;
        setD(det); setName(det.name || ""); setTg(det.telegram_url || ""); setLogo(det.logo_url || ""); setMembersCanAdd(!!det.members_can_add); setMembersCanCreate(!!det.members_can_create);
      } catch (e) { if (alive) setErr(e.message || t("err_generic")); }
      // Объявления — отдельно и некритично (таблица может отсутствовать до миграции).
      try { const ps = await listLeaguePosts(groupId, 10); if (alive) setPosts(ps); } catch (e) { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [groupId]);

  const publishPost = async () => {
    const clean = postText.trim();
    if (!clean || posting) return;
    setPosting(true);
    try {
      const p = await postLeagueAnnouncement(groupId, clean);
      setPosts((prev) => [{ ...p, author_name: null }, ...prev].slice(0, 10));
      setPostText("");
    } catch (e) { setErr(e.message || t("err_generic")); }
    finally { setPosting(false); }
  };

  const removePost = async (id) => {
    try { await deleteLeaguePost(id); setPosts((ps) => ps.filter((p) => p.id !== id)); } catch (e) { /* ignore */ }
  };

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

  const copyCode = () => {
    if (!d?.invite_code) return;
    try { navigator.clipboard?.writeText(d.invite_code); } catch (_) {}
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const org = d?.organizer || {};
  const initial = (name.trim()[0] || "?").toUpperCase();
  const inp = { width: "100%", boxSizing: "border-box", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)", fontFamily: "'Outfit',sans-serif", outline: "none" };

  // Портал в body: иначе fixed-оверлей попадает в трансформируемого предка
  // (.pl-pop с анимацией) и «уезжает» вместе с нижней навигацией.
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: "'Outfit',sans-serif" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "20px 20px 0 0", padding: 18, paddingBottom: 0, boxShadow: "0 -8px 40px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)" }}>{t("league_manage")}</div>
          <button onClick={onClose} aria-label="✕" style={{ marginLeft: "auto", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--mut)", cursor: "pointer", padding: 6, display: "flex" }}><X size={16} /></button>
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
            <Section icon={<Crown size={13} style={{ color: "var(--lime)" }} />} title={t("league_team")}
              count={Array.isArray(d.organizers) && d.organizers.length ? 1 + d.organizers.length : null}
              open={openTeam} onToggle={() => setOpenTeam((v) => !v)}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginBottom: (Array.isArray(d.organizers) && d.organizers.length) ? 6 : 0 }}>
                <Avatar url={org.avatar_url} name={org.name} size={34} />
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{org.name || "—"}</div>
                <Crown size={16} style={{ color: "var(--lime)", marginLeft: "auto", flexShrink: 0 }} />
              </div>
              {Array.isArray(d.organizers) && d.organizers.map((o, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginBottom: 6 }}>
                  <Avatar url={o.avatar_url} name={o.name} size={30} />
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{o.name}</div>
                  <ShieldCheck size={14} style={{ color: "var(--lime)", marginLeft: "auto", flexShrink: 0 }} />
                </div>
              ))}
            </Section>

            {/* Телеграм-канал */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--mut)", marginBottom: 5 }}><Send size={12} /> {t("league_telegram")}</div>
              {canEdit ? (
                <>
                  <input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="https://t.me/..." inputMode="url" style={{ ...inp, fontSize: 15, padding: "9px 12px" }} />
                  <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 5 }}>{t("league_telegram_hint")}</div>
                </>
              ) : (tg ? <a href={tg} target="_blank" rel="noreferrer" style={{ color: "var(--lime)", fontSize: 14, textDecoration: "none", fontWeight: 600 }}>{t("league_open_channel")} →</a> : <div style={{ color: "var(--mut)", fontSize: 14 }}>—</div>)}
            </div>

            {/* Объявления лиги (сворачивается). Композер — владельцу/организатору;
                участники видят их и в колокольчике (+push, если включён). */}
            <Section icon={<Megaphone size={13} style={{ color: "var(--mut)" }} />} title={t("league_posts_title")}
              count={posts.length || null} open={openPosts} onToggle={() => setOpenPosts((v) => !v)}>
              {canEdit && (
                <div style={{ display: "flex", gap: 8, marginBottom: posts.length ? 8 : 0 }}>
                  <input value={postText} onChange={(e) => setPostText(e.target.value)} maxLength={500}
                    placeholder={t("league_post_placeholder")} onKeyDown={(e) => e.key === "Enter" && publishPost()}
                    style={{ ...inp, fontSize: 14, padding: "9px 12px", flex: 1 }} />
                  <button onClick={publishPost} disabled={posting || !postText.trim()}
                    style={{ flexShrink: 0, padding: "0 14px", borderRadius: 12, border: "none", cursor: posting || !postText.trim() ? "default" : "pointer", background: "var(--lime)", color: "var(--lime-fg)", fontWeight: 700, fontSize: 13, fontFamily: "'Outfit',sans-serif", opacity: posting || !postText.trim() ? 0.55 : 1 }}>
                    {posting ? "…" : t("league_post_send")}
                  </button>
                </div>
              )}
              {posts.length === 0 && <div style={{ color: "var(--mut)", fontSize: 14 }}>—</div>}
              {posts.map((p) => (
                <div key={p.id} style={{ position: "relative", padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word", paddingRight: canEdit ? 20 : 0 }}>{p.text}</div>
                  <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 3 }}>
                    {p.author_name ? p.author_name + " · " : ""}{(() => { try { return new Date(p.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } })()}
                  </div>
                  {canEdit && (
                    <button onClick={() => removePost(p.id)} aria-label={t("delete_btn")} title={t("delete_btn")}
                      style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", color: "var(--mut)", cursor: "pointer", padding: 2, display: "flex" }}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </Section>

            <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 6, marginTop: 2 }}>{t("league_rights_title")}</div>
            {/* #1/#3: кто может добавлять игроков. Видно всем участникам; переключать —
                только владельцу/организатору (для остальных плашка read-only). */}
            <div onClick={canEdit ? () => setMembersCanAdd((v) => !v) : undefined} role="switch" aria-checked={membersCanAdd} aria-disabled={!canEdit}
              style={{ display: "flex", alignItems: "flex-start", gap: 11, cursor: canEdit ? "pointer" : "default", marginBottom: 12, padding: "11px 12px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 14, opacity: canEdit ? 1 : 0.72 }}>
              <div style={{ flexShrink: 0, marginTop: 1, width: 42, height: 24, borderRadius: 999, background: membersCanAdd ? "var(--lime)" : "var(--line)", position: "relative", transition: "background .15s" }}>
                <span style={{ position: "absolute", top: 3, left: membersCanAdd ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t("members_can_add_label")}</div>
                <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 2, lineHeight: 1.35 }}>{t("members_can_add_hint")}</div>
              </div>
            </div>

            {/* #1/#3: кто может создавать игры и турниры (аналогично — видно всем, меняет владелец/организатор) */}
            <div onClick={canEdit ? () => setMembersCanCreate((v) => !v) : undefined} role="switch" aria-checked={membersCanCreate} aria-disabled={!canEdit}
              style={{ display: "flex", alignItems: "flex-start", gap: 11, cursor: canEdit ? "pointer" : "default", marginBottom: 12, padding: "11px 12px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 14, opacity: canEdit ? 1 : 0.72 }}>
              <div style={{ flexShrink: 0, marginTop: 1, width: 42, height: 24, borderRadius: 999, background: membersCanCreate ? "var(--lime)" : "var(--line)", position: "relative", transition: "background .15s" }}>
                <span style={{ position: "absolute", top: 3, left: membersCanCreate ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t("members_can_create_label")}</div>
                <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 2, lineHeight: 1.35 }}>{t("members_can_create_hint")}</div>
              </div>
            </div>

            {/* Код приглашения — #4: только тем, кто может приглашать (владелец/организатор
                или включено «участники могут добавлять»). */}
            {d.invite_code && (canEdit || membersCanAdd) && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "color-mix(in srgb,var(--lime) 8%,transparent)", border: "1px solid color-mix(in srgb,var(--lime) 30%,transparent)", borderRadius: 14, marginBottom: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--mut)" }}>{t("league_invite_label")}</div>
                  <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 20, letterSpacing: 4, color: "var(--lime)" }}>{d.invite_code}</div>
                </div>
                <button onClick={copyCode} style={{ marginLeft: "auto", background: "color-mix(in srgb,var(--lime) 18%,transparent)", border: "1px solid color-mix(in srgb,var(--lime) 35%,transparent)", borderRadius: 10, color: "var(--lime)", cursor: "pointer", padding: "7px 12px", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontFamily: "'Outfit',sans-serif" }}>
                  {copied ? <><Check size={13} /> {t("code_copied")}</> : <><Copy size={13} /> {t("copy_code")}</>}
                </button>
              </div>
            )}

            <div style={{ position: "sticky", bottom: 0, margin: "6px -18px 0", padding: "12px 18px", paddingBottom: "max(18px, env(safe-area-inset-bottom))", background: "var(--surface)", borderTop: "1px solid var(--line)" }}>
              {canEdit ? (
                <button onClick={save} disabled={busy || !dirty}
                  style={{ width: "100%", padding: 13, background: "var(--lime)", color: "var(--lime-fg)", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: dirty && !busy ? "pointer" : "default", opacity: dirty && !busy ? 1 : 0.55, fontFamily: "'Outfit',sans-serif" }}>
                  {saved ? t("league_saved") : busy ? t("league_saving") : t("league_save")}
                </button>
              ) : (
                <div style={{ textAlign: "center", fontSize: 12, color: "var(--mut)", padding: "4px 0 2px" }}>{t("league_view_only")}</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
