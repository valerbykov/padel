// components/ProfileEditor.jsx
// Личный кабинет = «карточка игрока» + настройки. Всплывающее окно (портал в body).
// Структура (макет 2026-07): герой (аватар + карусель «стаи» + стат-плитки со
// статистикой активной лиги + CTA «Вся статистика») → данные (аккордеон-строки:
// имя/телефон/Telegram, email read-only) → настройки (напоминания/язык/тема) →
// опасная зона (выход/удаление).
// Скорость открытия: гидратация из props.profile (кэш бутстрапа) — первый кадр без
// сети; getSession() вместо getUser() (0 RTT); profiles + notification_prefs одной
// параллельной волной; тренды стат-плиток грузятся фоном и не блокируют экран.
// Сохранение автоматическое: дебаунс после правок + flush при закрытии; статус в шапке.
// props: { onClose, onSaved, theme, lang, onThemeToggle, onLangChange, onOpenStats,
//          profile (из App, для мгновенного первого кадра), activeLeague }
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import { Camera, Check, Loader, LogOut, BarChart3, Sun, Moon, X, Bell, Trash2, User, Phone, Mail, Globe, ChevronRight, ChevronDown, Lock, ArrowUp, ArrowDown, MessageCircle } from "lucide-react";
import Avatar from "./Avatar";
import { t, setLang , dateLocale} from "../lib/i18n";
import { saveNotifPrefs, registerPush, OFFSET_OPTIONS } from "../lib/notifications";
import { cachePeek } from "../lib/cache";

// Иконка Telegram (фирменный самолётик) — вместо эмодзи-«самолёта» ✈️.
const TgPlane = ({ size = 14 }) => (
  <svg viewBox="0 0 448 512" width={size} height={size} fill="currentColor" aria-hidden="true" style={{ display: "block" }}>
    <path d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1L117.8 284 16.2 252.2c-22.1-6.9-22.5-22.1 4.6-32.7L418.2 66.4c18.4-6.8 34.5 4.4 28.5 32.2z" />
  </svg>
);

// Способ входа для чипа в шапке. yandex/telegram кладут provider в user_metadata
// (свои edge-функции), google/email — в identities/app_metadata.
const AUTH_PROVIDERS = {
  google:   { label: "Google",   icon: "G", color: "#4285F4" },
  yandex:   { label: "Yandex",   icon: "Я", color: "#FC3F1D" },
  telegram: { label: "Telegram", icon: <TgPlane size={13} />, color: "#229ED9" },
};

const PRESETS = Array.from({ length: 15 }, (_, i) => `/avatars/dog-${String(i + 1).padStart(2, "0")}.webp`);

// Шрифты НЕ импортируем с fonts.googleapis.com — они самохостятся (index.html,
// public/fonts): из РФ Google Fonts ходит плохо и тормозил каждое открытие ЛК.
const css = `
.pc-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;--yellow:#ffd23f;--lime-fg:#0a1612;
 font-family:'Outfit',sans-serif;color-scheme:dark;}
.pc-root.pc-light{--bg:#f2f7f4;--surface:#ffffff;--surface2:#e6f0ea;--line:#c4d9cc;--ink:#0d1f18;--mut:#4a7060;--lime:#2a7a00;--coral:#d93a1f;--yellow:#9a6800;--lime-fg:#ffffff;color-scheme:light;}
.pc-sheet{background:var(--bg);border:1px solid var(--line);border-radius:22px;box-shadow:0 24px 70px rgba(0,0,0,.55);display:flex;flex-direction:column;overflow:hidden;}
.pc-head{display:flex;align-items:center;gap:10px;padding:14px 14px 12px 20px;border-bottom:1px solid var(--line);flex-shrink:0;}
.pc-title{font-weight:800;letter-spacing:-0.3px;font-size:18px;margin:0;color:var(--ink);}
.pc-status{margin-left:auto;display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--mut);white-space:nowrap;}
.pc-close{width:34px;height:34px;border-radius:10px;background:var(--surface2);border:1px solid var(--line);color:var(--mut);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .12s,border-color .12s,color .12s;}
.pc-close:hover{background:color-mix(in srgb,var(--coral) 15%,var(--surface2));border-color:color-mix(in srgb,var(--coral) 45%,transparent);color:var(--coral);}
.pc-body{overflow-y:auto;overscroll-behavior:contain;padding:14px 14px 16px;flex:1;-webkit-overflow-scrolling:touch;}
.pc-d{font-weight:800;letter-spacing:-0.3px;color:var(--ink);}
.pc-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden;}
.pc-row{display:flex;align-items:center;gap:11px;padding:12px 14px;border-bottom:1px solid var(--line);background:none;border-left:none;border-right:none;border-top:none;width:100%;cursor:pointer;font-family:'Outfit',sans-serif;text-align:left;transition:background .12s;}
.pc-row:last-child{border-bottom:none;}
.pc-row:hover{background:color-mix(in srgb,var(--surface2) 60%,transparent);}
.pc-row-static{cursor:default;}
.pc-row-static:hover{background:none;}
.pc-chip{width:30px;height:30px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
.pc-rlabel{font-size:13px;color:var(--mut);flex-shrink:0;}
.pc-rname{font-size:13.5px;font-weight:600;color:var(--ink);}
.pc-rval{margin-left:auto;font-size:13.5px;font-weight:600;color:var(--ink);text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pc-edit{padding:2px 14px 14px 55px;border-bottom:1px solid var(--line);}
.pc-edit:last-child{border-bottom:none;}
.pc-camera{position:absolute;right:-4px;bottom:-2px;width:32px;height:32px;border-radius:50%;background:var(--lime);color:var(--lime-fg);border:3px solid var(--surface);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:filter .12s;}
.pc-camera:hover{filter:brightness(1.05);}
.pc-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;background:var(--surface2);border:1px solid var(--line);font-size:11.5px;color:var(--mut);font-weight:600;}
.pc-presets{overflow:hidden;margin-top:12px;-webkit-mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);}
.pc-marquee{display:flex;gap:8px;width:max-content;animation:pc-scroll 26s linear infinite;}
.pc-marquee:hover,.pc-marquee:active{animation-play-state:paused;}
@keyframes pc-scroll{from{transform:translateX(-50%)}to{transform:translateX(0)}}
@media (prefers-reduced-motion:reduce){.pc-presets{overflow-x:auto;mask-image:none;-webkit-mask-image:none}.pc-marquee{animation:none}}
.pc-preset{width:46px;height:46px;border-radius:50%;cursor:pointer;flex-shrink:0;background:var(--surface2);transition:transform .12s;}
.pc-preset:hover{transform:scale(1.08);}
.pc-tile{background:var(--surface2);border-radius:13px 13px 4px 4px;padding:10px 6px;text-align:center;min-height:64px;}
.pc-tile b{display:block;font-size:19px;font-weight:800;line-height:1.1;}
.pc-tile span{display:block;font-size:10.5px;color:var(--mut);margin-top:2px;}
.pc-trend{display:inline-flex;align-items:center;gap:2px;font-size:10px;font-weight:700;margin-top:4px;min-height:12px;}
.pc-cta{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;padding:11px;border:none;border-radius:4px 4px 13px 13px;background:color-mix(in srgb,var(--lime) 10%,transparent);color:var(--lime);font-family:'Outfit',sans-serif;font-size:12.5px;font-weight:700;cursor:pointer;width:100%;transition:background .12s;}
.pc-cta:hover{background:color-mix(in srgb,var(--lime) 16%,transparent);}
.pc-input{width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);font-family:'Outfit';font-size:16px;padding:11px 12px;outline:none;box-sizing:border-box;transition:border-color .15s,box-shadow .15s;}
.pc-input:focus{border-color:var(--lime);box-shadow:0 0 0 3px color-mix(in srgb,var(--lime) 18%,transparent);}
.pc-input::placeholder{color:var(--mut);}
.pc-label{font-size:12px;color:var(--mut);margin:0 0 5px 2px;font-weight:600;}
.pc-btn{background:var(--lime);color:var(--lime-fg);font-weight:800;border:none;border-radius:14px;cursor:pointer;transition:transform .12s,filter .15s;font-family:'Outfit',sans-serif;}
.pc-btn:hover:not(:disabled){filter:brightness(1.05);} .pc-btn:active:not(:disabled){transform:scale(.98);}
.pc-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
.pc-ghost{background:var(--surface2);color:var(--ink);border:1px solid var(--line);border-radius:12px;cursor:pointer;font-family:'Outfit';font-weight:700;transition:border-color .15s,background .12s;}
.pc-ghost:hover{border-color:color-mix(in srgb,var(--lime) 35%,transparent);}
.pc-seg{display:flex;gap:3px;background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:3px;margin-left:auto;flex-shrink:0;}
.pc-seg button{border:none;background:none;color:var(--mut);padding:5px 10px;border-radius:8px;cursor:pointer;font-family:'Outfit';font-weight:700;font-size:11px;display:flex;align-items:center;transition:background .12s,color .12s;}
.pc-seg button.on{background:var(--lime);color:var(--lime-fg);}
.pc-switch{width:44px;height:26px;border-radius:13px;border:none;cursor:pointer;flex-shrink:0;position:relative;transition:background .15s;}
.pc-switch span{position:absolute;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s;}
.pc-skel{background:var(--surface2);border-radius:10px;animation:pc-skel 1.1s ease-in-out infinite alternate;}
@keyframes pc-skel{from{opacity:.45}to{opacity:.9}}
@media (prefers-reduced-motion:reduce){.pc-skel{animation:none;opacity:.6}}
`;

export default function ProfileEditor({ onClose, onSaved, theme = "dark", onOpenStats, lang = "ru", onThemeToggle, onLangChange, profile = null, activeLeague = null }) {
  const pickLang = (l) => { setLang(l); onLangChange?.(l); };
  // Мгновенная гидратация из props.profile (кэш бутстрапа): первый кадр — без сети.
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState("");
  const [since, setSince] = useState(null);
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [profileId, setProfileId] = useState(profile?.id || null);
  const [whatsapp, setWhatsapp] = useState(profile?.contacts?.whatsapp || "");
  const [telegram, setTelegram] = useState(profile?.contacts?.telegram || "");
  const [loading, setLoading] = useState(!profile);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const [provider, setProvider] = useState(null);
  const [notif, setNotif] = useState({ enabled: false, offsets: [], notifyEvents: true });
  const [editRow, setEditRow] = useState(null); // 'name' | 'phone' | 'tg' | null
  const [saveState, setSaveState] = useState(null); // null | 'saving' | 'saved'
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delMsg, setDelMsg] = useState("");
  // Тренды стат-плиток (фон, не блокируют): { weekDelta, weekGames, form: [bool] }
  const [trend, setTrend] = useState(null);
  const dirtyRef = useRef(false);      // есть несохранённые правки
  const hydratedRef = useRef(false);   // первый рендер (не автосохранять при загрузке)
  const saveTmRef = useRef(null);

  // Моя строка лидерборда активной лиги — из кэша, мгновенно и без сети.
  const lbRow = (() => {
    if (!activeLeague?.id || !profileId) return null;
    const lb = cachePeek("lb:" + activeLeague.id);
    return Array.isArray(lb) ? lb.find((r) => r.id === profileId) || null : null;
  })();
  const winPct = lbRow && lbRow.matches > 0 ? Math.round(((lbRow.wins || 0) / lbRow.matches) * 100) : null;

  useEffect(() => {
    (async () => {
      // getSession — локально (0 RTT), в отличие от getUser (поход на auth-сервер).
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      // tg<id>@telegram.local — синтетический адрес входа через Telegram, не почта:
      // не показываем его и не даём утечь в фолбэк имени.
      setEmail(/@telegram\.local$/i.test(user.email || "") ? "" : (user.email || ""));
      setSince(user.created_at || null);
      const um = user.user_metadata || {}, am = user.app_metadata || {};
      const idents = Array.isArray(user.identities) ? user.identities.map((i) => i.provider) : [];
      const KNOWN = ["google", "yandex", "telegram"];
      setProvider(
        (KNOWN.includes(um.provider) && um.provider) ||
        idents.find((p) => KNOWN.includes(p)) ||
        (Array.isArray(am.providers) && am.providers.find((p) => KNOWN.includes(p))) ||
        am.provider || um.provider || "email"
      );
      // Одна параллельная волна вместо каскада из 4 последовательных RTT.
      // prefs берём прямым запросом: getNotifPrefs() внутри дёргает getUser() ещё раз.
      const [profQ, prefQ] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("notification_prefs").select("enabled, offsets, notify_events").eq("user_id", user.id).maybeSingle(),
      ]);
      const data = profQ.data;
      // Свежие данные не должны затирать правки, сделанные пока летел запрос.
      if (data && !dirtyRef.current) {
        // Яндекс (и старые входы) заполняют только profiles.name — раскладываем
        // его в имя/фамилию, чтобы «Имя» в ЛК не пустовало при имени в лиге.
        const nmParts = (!data.first_name && !data.last_name && (data.name || "").trim())
          ? data.name.trim().split(/\s+/) : null;
        setFirstName(data.first_name || (nmParts ? nmParts[0] : ""));
        setLastName(data.last_name || (nmParts ? nmParts.slice(1).join(" ") : ""));
        setPhone(data.phone || "");
        setAvatarUrl(data.avatar_url || "");
        setWhatsapp(data.contacts?.whatsapp || "");
        // Вход через Telegram: @ник из метаданных подставляем, пока свой не задан
        // (сервер telegram-auth тоже пишет его в contacts при каждом входе).
        setTelegram(data.contacts?.telegram || (um.username ? "@" + um.username : ""));
      }
      if (data) setProfileId(data.id);
      const p = prefQ.data;
      const offsets = Array.isArray(p?.offsets) && p.offsets.length ? p.offsets : [1440, 120];
      setNotif(p ? { enabled: !!p.enabled, offsets, notifyEvents: p.notify_events !== false } : { enabled: false, offsets, notifyEvents: true });
      setLoading(false);
      // Флаг — через макротаск: эффект автосейва на гидратационные setState отработает
      // раньше и будет пропущен, иначе сетевые данные пересохранялись бы сами в себя.
      setTimeout(() => { hydratedRef.current = true; }, 0);
    })();
  }, []);

  // Тренды для стат-плиток — фоном, после первого кадра. rating_changes за 7 дней:
  // сумма дельт = недельный тренд рейтинга, count = игр за неделю, знак последних
  // пяти дельт = полоска формы. Ошибки глотаем — плитки живут и без трендов.
  useEffect(() => {
    if (!lbRow || !activeLeague?.id || !profileId) return;
    let alive = true;
    (async () => {
      try {
        const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
        const { data } = await supabase.from("rating_changes")
          .select("delta, created_at").eq("profile_id", profileId).eq("group_id", activeLeague.id)
          .order("created_at", { ascending: false }).limit(30);
        if (!alive || !Array.isArray(data)) return;
        const week = data.filter((r) => r.created_at > weekAgo);
        setTrend({
          weekDelta: week.reduce((s, r) => s + (r.delta || 0), 0),
          weekGames: week.length,
          form: data.slice(0, 5).map((r) => (r.delta || 0) > 0),
        });
      } catch (e) { /* тренды опциональны */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeague?.id, profileId, !!lbRow]);

  const fullName = `${firstName} ${lastName}`.trim();

  /* ---------- автосохранение ---------- */
  const save = async () => {
    if (!userId) return;
    setSaveState("saving"); setMsg(null);
    try {
      // profiles.name — NOT NULL: пустые имя/фамилия заменяем телефоном/почтой.
      const safeName = fullName || phone.trim() || (email ? email.split("@")[0] : "") || t("pc_name_fallback");
      const { error } = await supabase.from("profiles").update({
        first_name: firstName || null, last_name: lastName || null,
        name: safeName, phone: phone || null, avatar_url: avatarUrl || null,
        // Телефон дублируем в contacts: чипы связи в статистике игрока (ContactLinks)
        // читают contacts, и без этого номер из кабинета никому не был виден.
        contacts: { whatsapp: whatsapp.trim() || undefined, telegram: telegram.trim() || undefined, phone: phone.trim() || undefined },
      }).eq("user_id", userId);
      if (error) throw error;
      dirtyRef.current = false;
      setSaveState("saved");
      onSaved?.();
    } catch (err) {
      setSaveState(null);
      setMsg({ ok: false, text: `${t("pc_error")}: ${err.message}` });
    }
  };
  // Дебаунс: правка любого поля → сохранение через 800 мс тишины.
  useEffect(() => {
    if (!hydratedRef.current || !userId) return;
    dirtyRef.current = true;
    clearTimeout(saveTmRef.current);
    saveTmRef.current = setTimeout(save, 800);
    return () => clearTimeout(saveTmRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName, phone, telegram, whatsapp, avatarUrl]);
  // Закрытие — не теряем хвост дебаунса.
  const handleClose = () => {
    clearTimeout(saveTmRef.current);
    if (dirtyRef.current) save();
    onClose?.();
  };

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

  /* ---------- напоминания ---------- */
  const setNotifState = async (next) => {
    const prev = notif;
    setNotif(next); // оптимистично
    try {
      await saveNotifPrefs(next);
      if (next.enabled) await registerPush();
    } catch (e) {
      setNotif(prev);
      setMsg({ ok: false, text: `${t("pc_notif_fail")}: ${e?.message || e}` });
    }
  };
  const toggleNotif = (on) => {
    const offsets = on && notif.offsets.length === 0 ? [1440, 120] : notif.offsets;
    setNotifState({ ...notif, enabled: on, offsets });
  };
  const toggleOffset = (min) => {
    const has = notif.offsets.includes(min);
    const offsets = has ? notif.offsets.filter((x) => x !== min) : [...notif.offsets, min];
    setNotifState({ ...notif, offsets });
  };

  const signOut = async () => { try { await supabase.auth.signOut(); } catch (e) {} onClose?.(); };

  const deleteAccount = async () => {
    setDeleting(true); setDelMsg("");
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      try { await supabase.auth.signOut(); } catch (e) {}
      onClose?.();
    } catch (err) {
      setDelMsg(`${t("pc_delete_fail")}: ${err.message || err}`);
      setDeleting(false);
    }
  };

  const prov = provider ? (AUTH_PROVIDERS[provider] || { label: t("pc_auth_email"), icon: "@", color: "var(--mut)" }) : null;
  // День включаем ради грамматики: в ru «с 8 июля 2026» (родительный падеж),
  // тогда как {month:'long'} дал бы «с июль 2026».
  const sinceLabel = since ? (() => {
    try { return t("pc_since").replace("{d}", new Date(since).toLocaleDateString(dateLocale(), { day: "numeric", month: "long", year: "numeric" })); }
    catch (e) { return null; }
  })() : null;
  const toggleRow = (r) => setEditRow((cur) => (cur === r ? null : r));
  const Chevron = ({ open }) => open
    ? <ChevronDown size={14} style={{ color: "var(--mut)", flexShrink: 0 }} />
    : <ChevronRight size={14} style={{ color: "var(--mut)", flexShrink: 0 }} />;

  return createPortal(
    <div className={"pc-root" + (theme === "light" ? " pc-light" : "")} onClick={handleClose}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.62)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}>
      <style>{css}</style>
      <div className="pc-sheet" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, maxHeight: "min(90vh, 780px)" }}>
        <div className="pc-head">
          <h2 className="pc-title">{t("profile_label")}</h2>
          <span className="pc-status" aria-live="polite">
            {saveState === "saving" && <><Loader size={12} /> {t("pc_saving")}</>}
            {saveState === "saved" && <><Check size={13} style={{ color: "var(--lime)" }} /> {t("pc_saved").toLowerCase()}</>}
          </span>
          <button className="pc-close" onClick={handleClose} aria-label={t("back")}><X size={16} /></button>
        </div>

        <div className="pc-body">
          {loading ? (
            /* Скелетон вместо «Загрузка…» — без прыжков макета */
            <div className="pc-card" style={{ padding: "18px 16px", textAlign: "center" }}>
              <div className="pc-skel" style={{ width: 92, height: 92, borderRadius: "50%", margin: "0 auto" }} />
              <div className="pc-skel" style={{ width: 160, height: 20, margin: "12px auto 0" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
                <div className="pc-skel" style={{ height: 64 }} /><div className="pc-skel" style={{ height: 64 }} /><div className="pc-skel" style={{ height: 64 }} />
              </div>
            </div>
          ) : !userId && !profile ? (
            <div className="pc-card" style={{ textAlign: "center", color: "var(--mut)", padding: 16 }}>{t("pc_login_to_edit")}</div>
          ) : (
            <>
              {/* ГЕРОЙ: аватар + стая + чипы + стат-плитки + CTA */}
              <div className="pc-card" style={{ padding: "18px 16px 14px", textAlign: "center" }}>
                <div style={{ position: "relative", display: "inline-block" }}>
                  <span style={{ display: "block", borderRadius: "50%", border: "3px solid var(--lime)", padding: 3 }}>
                    <Avatar url={avatarUrl} name={fullName} id={profileId || userId} size={86} />
                  </span>
                  <label className="pc-camera" aria-label={t("pc_upload_photo")} title={t("pc_upload_photo")}>
                    {uploading ? <Loader size={15} /> : <Camera size={15} />}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={upload} disabled={uploading} />
                  </label>
                </div>
                {fullName && <div className="pc-d" style={{ fontSize: 20, marginTop: 10 }}>{fullName}</div>}
                <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                  {prov && (
                    <span className="pc-pill">
                      <span style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: prov.color, color: "#fff", fontWeight: 800, fontSize: 9 }}>{prov.icon}</span>
                      {prov.label}
                    </span>
                  )}
                  {sinceLabel && <span className="pc-pill">{sinceLabel}</span>}
                </div>

                {/* Стая: бесшовная карусель пресетов (пауза при касании; reduced-motion → ручной скролл) */}
                <div className="pc-presets">
                  <div className="pc-marquee">
                    {[...PRESETS, ...PRESETS].map((u, i) => (
                      <img key={i} src={u} alt="" loading="lazy" onClick={() => setAvatarUrl(u)} className="pc-preset"
                        style={{ border: avatarUrl === u ? "2px solid var(--lime)" : "2px solid transparent" }} />
                    ))}
                  </div>
                </div>

                {/* Стат-плитки активной лиги (из кэша лидерборда) + мостик в статистику */}
                {lbRow && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
                      <div className="pc-tile">
                        <b style={{ color: "var(--lime)" }}>{lbRow.rating}</b>
                        <span>{t("pc_stat_rating")}</span>
                        <span className="pc-trend" style={{ color: trend && trend.weekDelta !== 0 ? (trend.weekDelta > 0 ? "var(--lime)" : "var(--coral)") : "transparent" }}>
                          {trend && trend.weekDelta !== 0 && (trend.weekDelta > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                          {trend && trend.weekDelta !== 0 ? (trend.weekDelta > 0 ? `+${trend.weekDelta}` : trend.weekDelta) : "·"}
                        </span>
                      </div>
                      <div className="pc-tile">
                        <b style={{ color: "var(--ink)" }}>{lbRow.matches || 0}</b>
                        <span>{t("pc_stat_games")}</span>
                        <span className="pc-trend" style={{ color: trend?.weekGames ? "var(--mut)" : "transparent", fontWeight: 600 }}>
                          {trend?.weekGames ? t("pc_week").replace("{n}", String(trend.weekGames)) : "·"}
                        </span>
                      </div>
                      <div className="pc-tile">
                        <b style={{ color: "var(--yellow)" }}>{winPct === null ? "—" : winPct + "%"}</b>
                        <span>{t("pc_stat_wins")}</span>
                        <span className="pc-trend" style={{ gap: 3, justifyContent: "center", width: "100%" }}>
                          {(trend?.form || []).map((w, i) => (
                            <span key={i} style={{ width: 7, height: 7, borderRadius: 2, background: w ? "var(--lime)" : "var(--coral)" }} />
                          ))}
                        </span>
                      </div>
                    </div>
                    {onOpenStats && (
                      <button className="pc-cta" onClick={onOpenStats}>
                        <BarChart3 size={14} /> {t("pc_all_stats")} <ChevronRight size={13} />
                      </button>
                    )}
                  </>
                )}
                {!lbRow && onOpenStats && (
                  <button className="pc-ghost" style={{ width: "100%", padding: 11, marginTop: 12, color: "var(--lime)", borderColor: "color-mix(in srgb, var(--lime) 35%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={onOpenStats}>
                    <BarChart3 size={14} /> {t("pc_open_stats")}
                  </button>
                )}
              </div>

              {/* ДАННЫЕ: аккордеон-строки */}
              <div className="pc-card" style={{ marginTop: 12 }}>
                <button className="pc-row" onClick={() => toggleRow("name")} aria-expanded={editRow === "name"}>
                  <span className="pc-chip" style={{ background: "color-mix(in srgb, var(--lime) 13%, transparent)", color: "var(--lime)" }}><User size={15} /></span>
                  <span className="pc-rlabel">{t("pc_first_name")}</span>
                  <span className="pc-rval">{fullName || "—"}</span>
                  <Chevron open={editRow === "name"} />
                </button>
                {editRow === "name" && (
                  <div className="pc-edit" style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}><div className="pc-label">{t("pc_first_name")}</div><input className="pc-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t("pc_first_name")} autoFocus /></div>
                    <div style={{ flex: 1 }}><div className="pc-label">{t("pc_last_name")}</div><input className="pc-input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t("pc_last_name")} /></div>
                  </div>
                )}
                <button className="pc-row" onClick={() => toggleRow("phone")} aria-expanded={editRow === "phone"}>
                  <span className="pc-chip" style={{ background: "color-mix(in srgb, var(--yellow) 13%, transparent)", color: "var(--yellow)" }}><Phone size={15} /></span>
                  <span className="pc-rlabel">{t("pc_phone")}</span>
                  <span className="pc-rval">{phone || "—"}</span>
                  <Chevron open={editRow === "phone"} />
                </button>
                {editRow === "phone" && (
                  <div className="pc-edit">
                    <input className="pc-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7…" inputMode="tel" autoFocus />
                  </div>
                )}
                <button className="pc-row" onClick={() => toggleRow("tg")} aria-expanded={editRow === "tg"}>
                  <span className="pc-chip" style={{ background: "rgba(34,158,217,.16)", color: "#4db8e8" }}><TgPlane size={15} /></span>
                  <span className="pc-rlabel">Telegram</span>
                  <span className="pc-rval">{telegram || "—"}</span>
                  <Chevron open={editRow === "tg"} />
                </button>
                {editRow === "tg" && (
                  <div className="pc-edit" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input className="pc-input" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" autoFocus />
                    {telegram.trim() && (
                      <a href={`https://t.me/${telegram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer"
                        style={{ flexShrink: 0, width: 40, height: 40, borderRadius: "50%", background: "#229ed9", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}><TgPlane size={20} /></a>
                    )}
                  </div>
                )}
                <button className="pc-row" onClick={() => toggleRow("wa")} aria-expanded={editRow === "wa"}>
                  <span className="pc-chip" style={{ background: "rgba(37,211,102,.14)", color: "#25d366" }}><MessageCircle size={15} /></span>
                  <span className="pc-rlabel">WhatsApp</span>
                  <span className="pc-rval">{whatsapp || "—"}</span>
                  <Chevron open={editRow === "wa"} />
                </button>
                {editRow === "wa" && (
                  <div className="pc-edit" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input className="pc-input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+7 999 000-00-00" inputMode="tel" autoFocus />
                    {whatsapp.trim() && (
                      <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                        style={{ flexShrink: 0, width: 40, height: 40, borderRadius: "50%", background: "#25d366", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}><MessageCircle size={20} /></a>
                    )}
                  </div>
                )}
                <div className="pc-row pc-row-static" title={t("pc_email_locked")}>
                  <span className="pc-chip" style={{ background: "color-mix(in srgb, var(--mut) 15%, transparent)", color: "var(--mut)" }}><Mail size={15} /></span>
                  <span className="pc-rlabel">{t("pc_email")}</span>
                  <span className="pc-rval" style={{ color: "var(--mut)", fontWeight: 400 }}>{email || "—"}</span>
                  <Lock size={12} style={{ color: "var(--mut)", opacity: .7, flexShrink: 0 }} />
                </div>
              </div>

              {msg && !msg.ok && <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: "var(--coral)" }}>{msg.text}</div>}

              {/* НАСТРОЙКИ: напоминания / язык / тема */}
              <div className="pc-card" style={{ marginTop: 12 }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span className="pc-chip" style={{ background: "color-mix(in srgb, var(--lime) 13%, transparent)", color: "var(--lime)" }}><Bell size={15} /></span>
                    <span className="pc-rname" style={{ minWidth: 0 }}>{t("notif_title")}</span>
                    <button className="pc-switch" role="switch" aria-checked={notif.enabled} onClick={() => toggleNotif(!notif.enabled)}
                      style={{ marginLeft: "auto", background: notif.enabled ? "var(--lime)" : "var(--surface2)", border: notif.enabled ? "none" : "1px solid var(--line)" }}>
                      <span style={{ left: notif.enabled ? 21 : 3 }} />
                    </button>
                  </div>
                  {notif.enabled && (
                    <>
                      <div className="pc-label" style={{ margin: "10px 0 0 41px", color: "var(--mut)" }}>{t("notif_desc")}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 7, marginLeft: 41 }}>
                        {OFFSET_OPTIONS.map((o) => {
                          const on = notif.offsets.includes(o.min);
                          return (
                            <button key={o.min} onClick={() => toggleOffset(o.min)}
                              style={{ padding: "6px 11px", borderRadius: 999, cursor: "pointer", fontFamily: "'Outfit',sans-serif",
                                fontSize: 11.5, fontWeight: 600,
                                background: on ? "color-mix(in srgb, var(--lime) 15%, transparent)" : "var(--surface2)",
                                color: on ? "var(--lime)" : "var(--mut)",
                                border: "1px solid " + (on ? "color-mix(in srgb, var(--lime) 35%, transparent)" : "var(--line)") }}>
                              {t(o.key)}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, marginLeft: 41 }}>
                        <span className="pc-label" style={{ margin: 0, color: "var(--mut)" }}>{t("notif_events_label")}</span>
                        <button className="pc-switch" role="switch" aria-checked={notif.notifyEvents} onClick={() => setNotifState({ ...notif, notifyEvents: !notif.notifyEvents })}
                          style={{ background: notif.notifyEvents ? "var(--lime)" : "var(--surface2)", border: notif.notifyEvents ? "none" : "1px solid var(--line)" }}>
                          <span style={{ left: notif.notifyEvents ? 21 : 3 }} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="pc-row pc-row-static">
                  <span className="pc-chip" style={{ background: "color-mix(in srgb, var(--yellow) 13%, transparent)", color: "var(--yellow)" }}><Globe size={15} /></span>
                  <span className="pc-rname">{t("pc_lang")}</span>
                  <div className="pc-seg">
                    {["ru", "en", "es"].map((l) => (
                      <button key={l} className={lang === l ? "on" : ""} onClick={() => pickLang(l)}>{l.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
                <div className="pc-row pc-row-static">
                  <span className="pc-chip" style={{ background: "color-mix(in srgb, var(--mut) 15%, transparent)", color: "var(--mut)" }}>{theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}</span>
                  <span className="pc-rname">{t("pc_theme")}</span>
                  <div className="pc-seg" role="group" aria-label={t("aria_theme")}>
                    <button className={theme === "dark" ? "on" : ""} onClick={() => theme !== "dark" && onThemeToggle?.()} aria-label="dark"><Moon size={13} /></button>
                    <button className={theme === "light" ? "on" : ""} onClick={() => theme !== "light" && onThemeToggle?.()} aria-label="light"><Sun size={13} /></button>
                  </div>
                </div>
              </div>

              {/* ОПАСНАЯ ЗОНА: выход и удаление — отдельно от обычных действий */}
              <div className="pc-card" style={{ marginTop: 12 }}>
                <button className="pc-row" onClick={signOut}>
                  <span className="pc-chip" style={{ background: "color-mix(in srgb, var(--mut) 15%, transparent)", color: "var(--mut)" }}><LogOut size={15} /></span>
                  <span className="pc-rname">{t("sign_out")}</span>
                </button>
                <button className="pc-row" onClick={() => { setDelMsg(""); setConfirmDel(true); }}>
                  <span className="pc-chip" style={{ background: "color-mix(in srgb, var(--coral) 14%, transparent)", color: "var(--coral)" }}><Trash2 size={15} /></span>
                  <span className="pc-rname" style={{ color: "var(--coral)" }}>{t("pc_delete_account")}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {confirmDel && (
        <div onClick={(e) => { e.stopPropagation(); if (!deleting) setConfirmDel(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 320, background: "var(--bg)", border: "1px solid color-mix(in srgb, var(--coral) 40%, transparent)", borderRadius: 18, padding: 18 }}>
            <div className="pc-d" style={{ fontSize: 17, marginBottom: 6 }}>{t("pc_delete_title")}</div>
            <div style={{ color: "var(--mut)", fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>{t("pc_delete_warn")}</div>
            {delMsg && <div style={{ color: "var(--coral)", fontSize: 13, marginBottom: 10 }}>{delMsg}</div>}
            <div style={{ display: "flex", gap: 9 }}>
              <button className="pc-ghost" style={{ flex: 1, padding: 10 }} disabled={deleting} onClick={() => setConfirmDel(false)}>{t("cancel")}</button>
              <button className="pc-btn" style={{ flex: 1, padding: 10, background: "var(--coral)", color: "var(--lime-fg)" }} disabled={deleting} onClick={deleteAccount}>{deleting ? t("pc_deleting") : t("pc_delete_confirm")}</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
