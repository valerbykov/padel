// components/AdminCreateUser.jsx
// Форма создания пользователя администратором.
// Дёргает Edge Function 'admin-create-user' (проверка прав — на сервере).
import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { UserPlus, Check, AlertCircle } from "lucide-react";

const css = `
.au-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;
 font-family:'Outfit',sans-serif;color:var(--ink);}
.au-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:18px;max-width:460px;}
.au-display{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;}
.au-label{font-size:12px;color:var(--mut);margin:10px 0 4px;}
.au-input{width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);
 font-family:'Outfit';padding:11px 12px;outline:none;box-sizing:border-box;}
.au-input:focus{border-color:var(--lime);}
.au-btn{width:100%;background:var(--lime);color:#0a1612;font-weight:700;border:none;border-radius:14px;padding:13px;
 cursor:pointer;margin-top:16px;display:flex;align-items:center;justify-content:center;gap:8px;}
.au-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
.au-msg{display:flex;align-items:center;gap:8px;font-size:13px;margin-top:12px;padding:10px 12px;border-radius:12px;}
`;

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function AdminCreateUser({ groupId }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [status, setStatus] = useState({ kind: "", text: "" }); // '', 'ok', 'err'
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.firstName.trim() && emailOk(form.email.trim());

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setStatus({ kind: "", text: "" });
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          groupId: groupId || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStatus({ kind: "ok", text: `Приглашение отправлено на ${form.email.trim()}` });
      setForm({ firstName: "", lastName: "", phone: "", email: "" });
    } catch (e) {
      const map = { forbidden: "Недостаточно прав", unauthorized: "Нужно войти", email_required: "Укажи email" };
      setStatus({ kind: "err", text: map[e.message] || "Ошибка: " + e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="au-root">
      <style>{css}</style>
      <div className="au-card">
        <div className="au-display" style={{ fontSize: 22, marginBottom: 4 }}>Новый игрок</div>
        <div style={{ fontSize: 12, color: "var(--mut)" }}>Пользователь получит письмо со ссылкой для входа</div>

        <div className="au-label">Имя *</div>
        <input className="au-input" value={form.firstName} onChange={set("firstName")} placeholder="Артём" />

        <div className="au-label">Фамилия</div>
        <input className="au-input" value={form.lastName} onChange={set("lastName")} placeholder="Иванов" />

        <div className="au-label">Телефон</div>
        <input className="au-input" type="tel" value={form.phone} onChange={set("phone")} placeholder="+7 900 000-00-00" />

        <div className="au-label">Email *</div>
        <input className="au-input" type="email" value={form.email} onChange={set("email")} placeholder="player@mail.com" />

        <button className="au-btn" disabled={!valid || busy} onClick={submit}>
          <UserPlus size={18} /> {busy ? "Создаю…" : "Создать пользователя"}
        </button>

        {status.kind && (
          <div className="au-msg" style={{
            background: status.kind === "ok" ? "rgba(200,255,45,.12)" : "rgba(255,106,82,.12)",
            color: status.kind === "ok" ? "var(--lime)" : "var(--coral)",
          }}>
            {status.kind === "ok" ? <Check size={16} /> : <AlertCircle size={16} />} {status.text}
          </div>
        )}
      </div>
    </div>
  );
}
