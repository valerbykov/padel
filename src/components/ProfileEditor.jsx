// components/ProfileEditor.jsx
// Личный кабинет = НАСТРОЙКИ профиля: фото/аватар, имя, телефон, WhatsApp/Telegram, почта.
// Статистика/история/уровень живут в карточке профиля игрока (вкладка «Друзья» → ты),
// поэтому здесь их не дублируем — даём указатель.
// props: { onClose, onSaved, theme }
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ArrowLeft, Camera, Check, Loader, LogOut, BarChart3, Sun, Moon } from "lucide-react";
import Avatar from "./Avatar";
import { t, setLang } from "../lib/i18n";

const PRESETS = Array.from({ length: 15 }, (_, i) => `/avatars/dog-${String(i + 1).padStart(2, "0")}.png`);

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.pc-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;--lime-fg:#0a1612;--topbar-bg:rgba(10,22,18,.92);
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;color-scheme:dark;}
.pc-root.pc-light{--bg:#f2f7f4;--surface:#ffffff;--surface2:#e6f0ea;--line:#c4d9cc;--ink:#0d1f18;--mut:#4a7060;--lime:#2a7a00;--coral:#d93a1f;--lime-fg:#ffffff;--topbar-bg:rgba(242,247,244,.95);color-scheme:light;}
.pc-topbar{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;padding-top:max(10px,env(safe-area-inset-top));border-bottom:1px solid var(--line);background:var(--topbar-bg);position:sticky;top:0;z-index:60;backdrop-filter:blur(10px);}
.pc-seg{display:flex;gap:4px;background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:3px;}
.pc-seg button{border:none;background:none;color:var(--ink);padding:5px 9px;border-radius:9px;cursor:pointer;font-family:'Outfit';font-weight:700;font-size:12px;display:flex;align-items:center;gap:5px;transition:filter .12s;}
.pc-seg button:hover{filter:brightness(1.1);}
.pc-d{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;}
.pc-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px;}
.pc-input{width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);font-family:'Outfit';font-size:16px;padding:11px 12px;outline:none;box-sizing:border-box;transition:border-color .15s,box-shadow .15s;}
.pc-input:focus{border-color:var(--lime);box-shadow:0 0 0 3px color-mix(in srgb,var(--lime) 18%,transparent);}
.pc-input::placeholder{color:var(--mut);}
.pc-input:disabled{color:var(--mut);}
.pc-label{font-size:12px;color:var(--mut);margin:0 0 5px 2px;}
.pc-btn{background:var(--lime);color:var(--lime-fg);font-weight:700;border:none;border-radius:14px;cursor:pointer;transition:transform .12s,filter .15s;}
.pc-btn:hover:not(:disabled){filter:brightness(1.05);} .pc-btn:active:not(:disabled){transform:scale(.98);}
.pc-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
.pc-ghost{background:var(--surface2);color:var(--ink);border:1px solid var(--line);border-radius:12px;cursor:pointer;transition:border-color .15s;}
.pc-ghost:hover{border-color:color-mix(in srgb,var(--lime) 35%,transparent);}
.pc-iconbtn{background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:6px 10px;cursor:pointer;color:var(--mut);font-family:'Outfit';font-size:12px;font-weight:700;display:flex;align-items:center;gap:5px;}
.pc-preset{width:46px;height:46px;border-radius:50%;cursor:pointer;background:var(--surface2);transition:transform .12s;}
.pc-preset:hover{transform:scale(1.08);}
`;

export default function ProfileEditor({ onClose, onSaved, theme = "dark", onOpenStats, lang = "ru", onThemeToggle, onLangChange }) {
  const cycleLang = () => { const o = ["ru", "en", "es"]; const next = o[(o.indexOf(lang) + 1) % o.length]; setLang(next); onLangChange?.(next); };
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

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      setEmail(user.email || "");
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
        setPhone(data.phone || "");
        setAvatarUrl(data.avatar_url || "");
        setWhatsapp(data.contacts?.whatsapp || "");
        setTelegram(data.contacts?.telegram || "");
      }
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

  return (
    <div className={"pc-root" + (theme === "light" ? " pc-light" : "")}>
      <style>{css}</style>
      {/* Топбар как у остальных вкладок: назад + сегмент язык/тема */}
      <div className="pc-topbar">
        <button className="pc-ghost" style={{ padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={onClose}><ArrowLeft size={14} /> {t("back")}</button>
        <div className="pc-seg">
          <button onClick={cycleLang} aria-label={t("aria_lang")}>{lang.toUpperCase()} <span style={{ color: "var(--mut)", fontWeight: 400, fontSize: 13 }}>↻</span></button>
          <button onClick={onThemeToggle} aria-label={t("aria_theme")} style={{ padding: "5px 8px" }}>{theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}</button>
        </div>
      </div>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "16px 16px 40px" }}>
        {/* Заголовок + переход к статистике (кнопка как «Личный кабинет» в карточке игрока) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <h1 className="pc-d" style={{ fontSize: 26, margin: 0, flex: 1, minWidth: 0 }}>{t("pc_title")}</h1>
          {onOpenStats && userId && (
            <button className="pc-ghost" style={{ padding: "6px 12px", color: "var(--lime)", borderColor: "color-mix(in srgb, var(--lime) 35%, transparent)", flexShrink: 0 }} onClick={onOpenStats}>{t("pc_open_stats")}</button>
          )}
        </div>

        {loading ? (
          <div className="pc-card" style={{ textAlign: "center", color: "var(--mut)" }}>{t("loading")}</div>
        ) : !userId ? (
          <div className="pc-card" style={{ textAlign: "center", color: "var(--mut)" }}>{t("pc_login_to_edit")}</div>
        ) : (
          <>
            <div className="pc-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <Avatar url={avatarUrl} name={fullName} id={userId} size={96} style={{ border: "2px solid var(--line)" }} />
              <label className="pc-ghost" style={{ padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                {uploading ? <Loader size={15} /> : <Camera size={15} />} {uploading ? t("pc_uploading") : t("pc_upload_photo")}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={upload} disabled={uploading} />
              </label>
              <div style={{ fontSize: 12, color: "var(--mut)" }}>{t("pc_or_pick")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {PRESETS.map((u) => (
                  <img key={u} src={u} alt="" loading="lazy" onClick={() => setAvatarUrl(u)} className="pc-preset" style={{
                    border: avatarUrl === u ? "2px solid var(--lime)" : "2px solid transparent",
                  }} />
                ))}
              </div>
            </div>

            <div className="pc-card" style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
              <div><div className="pc-label">{t("pc_first_name")}</div><input className="pc-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t("pc_first_name")} /></div>
              <div><div className="pc-label">{t("pc_last_name")}</div><input className="pc-input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t("pc_last_name")} /></div>
              <div><div className="pc-label">{t("pc_phone")}</div><input className="pc-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7…" inputMode="tel" /></div>
              <div>
                <div className="pc-label">WhatsApp</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input className="pc-input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+7 999 000-00-00" inputMode="tel" />
                  {whatsapp.trim() && (
                    <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                      style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", background: "#25d366", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 17 }}>💬</a>
                  )}
                </div>
              </div>
              <div>
                <div className="pc-label">Telegram</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input className="pc-input" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" />
                  {telegram.trim() && (
                    <a href={`https://t.me/${telegram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer"
                      style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", background: "#229ed9", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 17 }}>✈️</a>
                  )}
                </div>
              </div>
              <div><div className="pc-label">{t("pc_email")}</div><input className="pc-input" value={email} disabled /></div>
            </div>

            <button className="pc-btn" style={{ width: "100%", padding: 14, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} disabled={busy} onClick={save}>
              <Check size={18} /> {busy ? t("pc_saving") : t("pc_save")}
            </button>
            {msg && <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: msg.ok ? "var(--lime)" : "var(--coral)" }}>{msg.text}{msg.ok ? " ✓" : ""}</div>}

            <button className="pc-ghost" style={{ width: "100%", padding: 12, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--coral)" }} onClick={signOut}>
              <LogOut size={15} /> {t("sign_out")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
