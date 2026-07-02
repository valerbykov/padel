// components/ProfileEditor.jsx
// Личный кабинет = НАСТРОЙКИ профиля: фото/аватар, имя, телефон, WhatsApp/Telegram, почта.
// Всплывающее окно (портал в body): центрированная карточка, крестик, hero-аватар,
// поля, настройки (язык/тема) и выход. Статистика/уровень — в карточке игрока.
// props: { onClose, onSaved, theme, lang, onThemeToggle, onLangChange, onOpenStats }
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import { Camera, Check, Loader, LogOut, BarChart3, Sun, Moon, X, Bell } from "lucide-react";
import Avatar from "./Avatar";
import { t, setLang } from "../lib/i18n";
import { getNotifPrefs, saveNotifPrefs, registerPush, OFFSET_OPTIONS } from "../lib/notifications";

// Иконка Telegram (фирменный самолётик) — вместо эмодзи-«самолёта» ✈️.
const TgPlane = ({ size = 14 }) => (
  <svg viewBox="0 0 448 512" width={size} height={size} fill="currentColor" aria-hidden="true" style={{ display: "block" }}>
    <path d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1L117.8 284 16.2 252.2c-22.1-6.9-22.5-22.1 4.6-32.7L418.2 66.4c18.4-6.8 34.5 4.4 28.5 32.2z" />
  </svg>
);

// #7 (пред. раунд): способ входа для подписи в ЛК. yandex/telegram кладут provider в
// user_metadata (свои edge-функции), google/email — в app_metadata (нативные провайдеры).
const AUTH_PROVIDERS = {
  google:   { label: "Google",   icon: "G", color: "#4285F4" },
  yandex:   { label: "Yandex",   icon: "Я", color: "#FC3F1D" },
  telegram: { label: "Telegram", icon: <TgPlane size={13} />, color: "#229ED9" },
};

const PRESETS = Array.from({ length: 15 }, (_, i) => `/avatars/dog-${String(i + 1).padStart(2, "0")}.webp`);

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700;800&display=swap');
.pc-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;--lime-fg:#0a1612;
 font-family:'Outfit',sans-serif;color-scheme:dark;}
.pc-root.pc-light{--bg:#f2f7f4;--surface:#ffffff;--surface2:#e6f0ea;--line:#c4d9cc;--ink:#0d1f18;--mut:#4a7060;--lime:#2a7a00;--coral:#d93a1f;--lime-fg:#ffffff;color-scheme:light;}
.pc-sheet{background:var(--bg);border:1px solid var(--line);border-radius:22px;box-shadow:0 24px 70px rgba(0,0,0,.55);display:flex;flex-direction:column;overflow:hidden;}
.pc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 16px 14px 20px;border-bottom:1px solid var(--line);flex-shrink:0;}
.pc-title{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;font-size:20px;margin:0;color:var(--ink);}
.pc-close{width:36px;height:36px;border-radius:50%;background:var(--surface2);border:1px solid var(--line);color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .12s,border-color .12s,color .12s;}
.pc-close:hover{background:color-mix(in srgb,var(--coral) 15%,var(--surface2));border-color:color-mix(in srgb,var(--coral) 45%,transparent);color:var(--coral);}
.pc-body{overflow-y:auto;padding:20px;flex:1;-webkit-overflow-scrolling:touch;}
.pc-d{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;color:var(--ink);}
.pc-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px;}
.pc-camera{position:absolute;right:-3px;bottom:-3px;width:32px;height:32px;border-radius:50%;background:var(--lime);color:var(--lime-fg);border:3px solid var(--bg);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:filter .12s;}
.pc-camera:hover{filter:brightness(1.05);}
.pc-provider{display:inline-flex;align-items:center;gap:7px;padding:3px 11px 3px 4px;border-radius:999px;background:var(--surface2);border:1px solid var(--line);font-size:12px;color:var(--mut);font-weight:600;}
.pc-presets{overflow:hidden;padding:8px 0 2px;-webkit-mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);}
.pc-marquee{display:flex;gap:8px;width:max-content;animation:pc-scroll 26s linear infinite;}
.pc-marquee:hover{animation-play-state:paused;}
@keyframes pc-scroll{from{transform:translateX(-50%)}to{transform:translateX(0)}}
@media (prefers-reduced-motion:reduce){.pc-presets{overflow-x:auto}.pc-marquee{animation:none}}
.pc-preset{width:44px;height:44px;border-radius:50%;cursor:pointer;flex-shrink:0;background:var(--surface2);transition:transform .12s;}
.pc-preset:hover{transform:scale(1.08);}
.pc-input{width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);font-family:'Outfit';font-size:16px;padding:11px 12px;outline:none;box-sizing:border-box;transition:border-color .15s,box-shadow .15s;}
.pc-input:focus{border-color:var(--lime);box-shadow:0 0 0 3px color-mix(in srgb,var(--lime) 18%,transparent);}
.pc-input::placeholder{color:var(--mut);}
.pc-input:disabled{color:var(--mut);opacity:.85;}
.pc-label{font-size:12px;color:var(--mut);margin:0 0 5px 2px;font-weight:600;}
.pc-btn{background:var(--lime);color:var(--lime-fg);font-weight:800;border:none;border-radius:14px;cursor:pointer;transition:transform .12s,filter .15s;}
.pc-btn:hover:not(:disabled){filter:brightness(1.05);} .pc-btn:active:not(:disabled){transform:scale(.98);}
.pc-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
.pc-ghost{background:var(--surface2);color:var(--ink);border:1px solid var(--line);border-radius:12px;cursor:pointer;font-family:'Outfit';font-weight:700;transition:border-color .15s,background .12s;}
.pc-ghost:hover{border-color:color-mix(in srgb,var(--lime) 35%,transparent);}
.pc-seg{display:flex;gap:3px;background:var(--surface2);border:1px solid var(--line);border-radius:11px;padding:3px;}
.pc-seg button{border:none;background:none;color:var(--mut);padding:6px 13px;border-radius:8px;cursor:pointer;font-family:'Outfit';font-weight:700;font-size:13px;transition:background .12s,color .12s;}
.pc-seg button.on{background:var(--lime);color:var(--lime-fg);}
`;

export default function ProfileEditor({ onClose, onSaved, theme = "dark", onOpenStats, lang = "ru", onThemeToggle, onLangChange }) {
  const pickLang = (l) => { setLang(l); onLangChange?.(l); };
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const [whatsapp, setWhatsapp] = useState("");
  const [telegram, setTelegram] = useState("");
  const [provider, setProvider] = useState(null);
  const [notif, setNotif] = useState({ enabled: false, offsets: [] });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      setEmail(user.email || "");
      // Способ входа. yandex/telegram (свои edge-функции) кладут provider в user_metadata,
      // но их identity в Supabase — email (magic-link), поэтому их берём ПЕРВЫМИ. Google —
      // нативный OAuth: его вернёт user.identities (надёжнее, чем app_metadata.provider,
      // который у аккаунта с email+Google может остаться "email").
      const um = user.user_metadata || {}, am = user.app_metadata || {};
      const idents = Array.isArray(user.identities) ? user.identities.map((i) => i.provider) : [];
      const KNOWN = ["google", "yandex", "telegram"];
      setProvider(
        (KNOWN.includes(um.provider) && um.provider) ||
        idents.find((p) => KNOWN.includes(p)) ||
        (Array.isArray(am.providers) && am.providers.find((p) => KNOWN.includes(p))) ||
        am.provider || um.provider || "email"
      );
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
        setPhone(data.phone || "");
        setAvatarUrl(data.avatar_url || "");
        setWhatsapp(data.contacts?.whatsapp || "");
        setTelegram(data.contacts?.telegram || "");
      }
      try { const np = await getNotifPrefs(); setNotif(np); } catch (e) { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const fullName = `${firstName} ${lastName}`.trim();

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true); setMsg(null);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/avatar_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "31536000" });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch (err) { setMsg({ ok: false, text: `${t("pc_upload_fail")}: ${err.message}` }); }
    finally { setUploading(false); }
  };

  const setNotifState = async (next) => {
    setNotif(next);
    try { await saveNotifPrefs(next); if (next.enabled) await registerPush(); } catch (e) { /* ignore */ }
  };
  const toggleNotif = (on) => {
    const offsets = on && notif.offsets.length === 0 ? [1440, 120] : notif.offsets;
    setNotifState({ enabled: on, offsets });
  };
  const toggleOffset = (min) => {
    const has = notif.offsets.includes(min);
    const offsets = has ? notif.offsets.filter((x) => x !== min) : [...notif.offsets, min];
    setNotifState({ ...notif, offsets });
  };

  const save = async () => {
    if (!userId) return;
    setBusy(true); setMsg(null);
    try {
      const { error } = await supabase.from("profiles").update({
        first_name: firstName || null, last_name: lastName || null,
        name: fullName || null, phone: phone || null, avatar_url: avatarUrl || null,
        contacts: { whatsapp: whatsapp.trim() || undefined, telegram: telegram.trim() || undefined },
      }).eq("user_id", userId);
      if (error) throw error;
      setMsg({ ok: true, text: t("pc_saved") });
      onSaved?.();
    } catch (err) { setMsg({ ok: false, text: `${t("pc_error")}: ${err.message}` }); }
    finally { setBusy(false); }
  };

  const signOut = async () => { try { await supabase.auth.signOut(); } catch (e) {} onClose?.(); };

  const prov = provider ? (AUTH_PROVIDERS[provider] || { label: t("pc_auth_email"), icon: "@", color: "var(--mut)" }) : null;

  return createPortal(
    <div className={"pc-root" + (theme === "light" ? " pc-light" : "")} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.62)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}>
      <style>{css}</style>
      <div className="pc-sheet" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, maxHeight: "min(90vh, 760px)" }}>
        {/* Шапка: заголовок + явный крестик */}
        <div className="pc-head">
          <h2 className="pc-title">{t("pc_title")}</h2>
          <button className="pc-close" onClick={onClose} aria-label={t("back")}><X size={18} /></button>
        </div>

        <div className="pc-body">
          {loading ? (
            <div className="pc-card" style={{ textAlign: "center", color: "var(--mut)" }}>{t("loading")}</div>
          ) : !userId ? (
            <div className="pc-card" style={{ textAlign: "center", color: "var(--mut)" }}>{t("pc_login_to_edit")}</div>
          ) : (
            <>
              {/* Hero: аватар с камерой + имя + способ входа */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ position: "relative" }}>
                  <Avatar url={avatarUrl} name={fullName} id={userId} size={94} style={{ border: "2px solid var(--line)" }} />
                  <label className="pc-camera" aria-label={t("pc_upload_photo")} title={t("pc_upload_photo")}>
                    {uploading ? <Loader size={15} /> : <Camera size={15} />}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={upload} disabled={uploading} />
                  </label>
                </div>
                {fullName && <div className="pc-d" style={{ fontSize: 19 }}>{fullName}</div>}
                {prov && (
                  <span className="pc-provider">
                    <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: prov.color, color: "#fff", fontWeight: 800, fontSize: 11 }}>{prov.icon}</span>
                    {prov.label}
                  </span>
                )}
              </div>

              {/* Пресеты аватара — горизонтальная лента */}
              <div className="pc-label" style={{ textAlign: "center", marginTop: 12 }}>{t("pc_or_pick")}</div>
              <div className="pc-presets">
                {/* Бесконечная лента аватарок: список продублирован, трек едет вправо и
                    зацикливается бесшовно; на hover пауза, чтобы можно было выбрать. */}
                <div className="pc-marquee">
                  {[...PRESETS, ...PRESETS].map((u, i) => (
                    <img key={i} src={u} alt="" loading="lazy" onClick={() => setAvatarUrl(u)} className="pc-preset"
                      style={{ border: avatarUrl === u ? "2px solid var(--lime)" : "2px solid transparent" }} />
                  ))}
                </div>
              </div>

              {/* Поля */}
              <div className="pc-card" style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}><div className="pc-label">{t("pc_first_name")}</div><input className="pc-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t("pc_first_name")} /></div>
                  <div style={{ flex: 1 }}><div className="pc-label">{t("pc_last_name")}</div><input className="pc-input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t("pc_last_name")} /></div>
                </div>
                <div><div className="pc-label">{t("pc_phone")}</div><input className="pc-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7…" inputMode="tel" /></div>
                <div>
                  <div className="pc-label">Telegram</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input className="pc-input" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" />
                    {telegram.trim() && (
                      <a href={`https://t.me/${telegram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer"
                        style={{ flexShrink: 0, width: 40, height: 40, borderRadius: "50%", background: "#229ed9", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}><TgPlane size={20} /></a>
                    )}
                  </div>
                </div>
                <div><div className="pc-label">{t("pc_email")}</div><input className="pc-input" value={email} disabled /></div>
              </div>

              <button className="pc-btn" style={{ width: "100%", padding: 14, fontSize: 16, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} disabled={busy} onClick={save}>
                <Check size={18} /> {busy ? t("pc_saving") : t("pc_save")}
              </button>
              {msg && <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: msg.ok ? "var(--lime)" : "var(--coral)" }}>{msg.text}{msg.ok ? " ✓" : ""}</div>}

              {onOpenStats && (
                <button className="pc-ghost" style={{ width: "100%", padding: 12, marginTop: 10, color: "var(--lime)", borderColor: "color-mix(in srgb, var(--lime) 35%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={onOpenStats}>
                  <BarChart3 size={15} /> {t("pc_open_stats")}
                </button>
              )}

              {/* Настройки: язык + тема */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14 }}>
                <div className="pc-seg">
                  {["ru", "en", "es"].map((l) => (
                    <button key={l} className={lang === l ? "on" : ""} onClick={() => pickLang(l)}>{l.toUpperCase()}</button>
                  ))}
                </div>
                <button className="pc-close" onClick={onThemeToggle} aria-label={t("aria_theme")}>
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              </div>

              {/* Напоминания о сборе (личные офсеты; сервер шлёт push по ним) */}
              <div style={{ marginTop: 12, padding: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Bell size={16} style={{ color: "var(--lime)", flexShrink: 0 }} />
                    <span className="pc-label" style={{ margin: 0 }}>{t("notif_title")}</span>
                  </div>
                  <button role="switch" aria-checked={notif.enabled} onClick={() => toggleNotif(!notif.enabled)}
                    style={{ width: 44, height: 26, borderRadius: 13, border: "none", cursor: "pointer", flexShrink: 0,
                      background: notif.enabled ? "var(--lime)" : "var(--surface2)", position: "relative", transition: "background .15s" }}>
                    <span style={{ position: "absolute", top: 3, left: notif.enabled ? 21 : 3, width: 20, height: 20,
                      borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                  </button>
                </div>
                {notif.enabled && (
                  <>
                    <div className="pc-label" style={{ marginTop: 10, marginBottom: 6, color: "var(--mut)" }}>{t("notif_desc")}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {OFFSET_OPTIONS.map((o) => {
                        const on = notif.offsets.includes(o.min);
                        return (
                          <button key={o.min} onClick={() => toggleOffset(o.min)}
                            style={{ padding: "7px 12px", borderRadius: 10, cursor: "pointer", fontFamily: "'Outfit',sans-serif",
                              fontSize: 13, fontWeight: 700,
                              background: on ? "color-mix(in srgb, var(--lime) 16%, transparent)" : "var(--surface2)",
                              color: on ? "var(--lime)" : "var(--ink)",
                              border: "1px solid " + (on ? "color-mix(in srgb, var(--lime) 45%, transparent)" : "var(--line)") }}>
                            {t(o.key)}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <button className="pc-ghost" style={{ width: "100%", padding: 12, marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--coral)", borderColor: "color-mix(in srgb, var(--coral) 30%, transparent)" }} onClick={signOut}>
                <LogOut size={15} /> {t("sign_out")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
