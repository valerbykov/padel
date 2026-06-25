// components/ProfileEditor.jsx
// Личный кабинет: ФИО, почта (только просмотр), телефон, фото или аватар.
// props: { onClose, onSaved }
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ArrowLeft, Camera, Check, Loader } from "lucide-react";

const PRESETS = Array.from({ length: 15 }, (_, i) => `/avatars/dog-${String(i + 1).padStart(2, "0")}.png`);

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.pc-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;color-scheme:dark;}
.pc-root.pc-light{--bg:#f2f7f4;--surface:#ffffff;--surface2:#e6f0ea;--line:#c4d9cc;--ink:#0d1f18;--mut:#4a7060;--lime:#2a7a00;color-scheme:light;}
.pc-d{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;}
.pc-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px;}
.pc-input{width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);font-family:'Outfit';padding:11px 12px;outline:none;box-sizing:border-box;}
.pc-input:focus{border-color:var(--lime);}
.pc-input:disabled{color:var(--mut);}
.pc-label{font-size:12px;color:var(--mut);margin:0 0 5px 2px;}
.pc-btn{background:var(--lime);color:#0a1612;font-weight:700;border:none;border-radius:14px;cursor:pointer;}
.pc-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
.pc-ghost{background:var(--surface2);color:var(--ink);border:1px solid var(--line);border-radius:12px;cursor:pointer;}
`;

function Preview({ url, name, size = 96 }) {
  const initials = (name || "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return url
    ? <img src={url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--line)" }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.33, color: "var(--lime)" }}>{initials}</div>;
}

export default function ProfileEditor({ onClose, onSaved, theme = "dark" }) {
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
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
    setUploading(true); setMsg("");
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/avatar_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "31536000" });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch (err) { setMsg("Не удалось загрузить фото: " + err.message); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!userId) return;
    setBusy(true); setMsg("");
    try {
      const { error } = await supabase.from("profiles").update({
        first_name: firstName || null, last_name: lastName || null,
        name: fullName || null, phone: phone || null, avatar_url: avatarUrl || null,
        contacts: { whatsapp: whatsapp.trim() || undefined, telegram: telegram.trim() || undefined },
      }).eq("user_id", userId);
      if (error) throw error;
      setMsg("Сохранено ✓");
      onSaved?.();
    } catch (err) { setMsg("Ошибка: " + err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className={"pc-root" + (theme === "light" ? " pc-light" : "")}>
      <style>{css}</style>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "20px 16px 40px" }}>
        <button className="pc-ghost" style={{ padding: "6px 12px", marginBottom: 16 }} onClick={onClose}><ArrowLeft size={14} /> Назад</button>
        <h1 className="pc-d" style={{ fontSize: 26, marginBottom: 16 }}>Личный кабинет</h1>

        {loading ? (
          <div className="pc-card" style={{ textAlign: "center", color: "var(--mut)" }}>Загрузка…</div>
        ) : !userId ? (
          <div className="pc-card" style={{ textAlign: "center", color: "var(--mut)" }}>Войди в аккаунт, чтобы редактировать профиль.</div>
        ) : (
          <>
            <div className="pc-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <Preview url={avatarUrl} name={fullName} />
              <label className="pc-ghost" style={{ padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                {uploading ? <Loader size={15} /> : <Camera size={15} />} {uploading ? "Загрузка…" : "Загрузить фото"}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={upload} disabled={uploading} />
              </label>
              <div style={{ fontSize: 12, color: "var(--mut)" }}>или выбери аватар:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {PRESETS.map((u) => (
                  <img key={u} src={u} alt="" onClick={() => setAvatarUrl(u)} style={{
                    width: 46, height: 46, borderRadius: "50%", cursor: "pointer",
                    border: avatarUrl === u ? "2px solid var(--lime)" : "2px solid transparent", background: "var(--surface2)",
                  }} />
                ))}
              </div>
            </div>

            <div className="pc-card" style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
              <div><div className="pc-label">Имя</div><input className="pc-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Имя" /></div>
              <div><div className="pc-label">Фамилия</div><input className="pc-input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Фамилия" /></div>
              <div><div className="pc-label">Телефон</div><input className="pc-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7…" inputMode="tel" /></div>
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
              <div><div className="pc-label">Почта</div><input className="pc-input" value={email} disabled /></div>
            </div>

            <button className="pc-btn" style={{ width: "100%", padding: 14, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} disabled={busy} onClick={save}>
              <Check size={18} /> {busy ? "Сохраняю…" : "Сохранить"}
            </button>
            {msg && <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: msg.startsWith("Сохранено") ? "var(--lime)" : "var(--coral)" }}>{msg}</div>}
          </>
        )}
      </div>
    </div>
  );
}
