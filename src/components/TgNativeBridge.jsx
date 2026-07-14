// components/TgNativeBridge.jsx
// Страница-мост для входа через Telegram в НАТИВНОМ приложении. Открывается в
// СИСТЕМНОМ браузере по адресу https://padelpack.app/tg-native (там домен
// настоящий → виджет Telegram проходит проверку домена, а попап работает как в
// обычном браузере — в отличие от Android WebView). После авторизации виджета
// зовём edge-функцию telegram-auth, получаем одноразовый token_hash и
// возвращаем его в приложение по deep link padelpack://login-callback?tgauth=1…,
// где App.jsx меняет его на сессию (см. handleTelegramCallback).
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { t } from "../lib/i18n";

const NATIVE_REDIRECT = "padelpack://login-callback";

export default function TgNativeBridge({ botName }) {
  const ref = useRef(null);
  const [status, setStatus] = useState(""); // '', 'busy', 'error', 'done'

  useEffect(() => {
    window.__tgAuth = async (user) => {
      setStatus("busy");
      try {
        const { data, error } = await supabase.functions.invoke("telegram-auth", { body: user });
        if (error || data?.error) throw new Error(data?.error || "auth_failed");
        if (!data.token_hash) throw new Error("no_token");
        // ВАЖНО: не делаем window.location = "padelpack://…" из JS — браузер
        // блокирует переход на кастомную схему без пользовательского жеста
        // (жест «съел» fetch выше). Вместо этого идём на эндпоинт Supabase
        // /auth/v1/verify — он делает СЕРВЕРНЫЙ 302 на deep link с токенами в
        // #фрагменте, что открывает приложение надёжно (как Google/Apple).
        // База — прокси (доступен из РФ), иначе прямой Supabase.
        const base = (import.meta.env.VITE_SUPABASE_PROXY_URL || import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
        const verifyUrl = `${base}/auth/v1/verify?token=${encodeURIComponent(data.token_hash)}&type=magiclink&redirect_to=${encodeURIComponent(NATIVE_REDIRECT)}`;
        setStatus("done");
        window.location.href = verifyUrl;
      } catch (e) {
        setStatus("error");
      }
    };
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-onauth", "__tgAuth(user)");
    script.setAttribute("data-request-access", "write");
    ref.current?.appendChild(script);
    return () => { try { delete window.__tgAuth; } catch (e) {} };
  }, [botName]);

  return (
    <div style={{ minHeight: "100dvh", background: "#0a1612", color: "#eef3ee", fontFamily: "'Outfit',system-ui,sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 800 }}>
        <span style={{ color: "#c8ff2d" }}>Padel</span>Pack
      </div>
      <div style={{ fontSize: 14, color: "#7d9488", maxWidth: 300, lineHeight: 1.5 }}>{t("tg_bridge_hint")}</div>
      <div ref={ref} />
      {status === "busy" && <p style={{ color: "#7d9488", fontSize: 13 }}>{t("tg_signing")}</p>}
      {status === "done" && <p style={{ color: "#c8ff2d", fontSize: 13 }}>{t("tg_bridge_return")}</p>}
      {status === "error" && <p style={{ color: "#ff6a52", fontSize: 13 }}>{t("err_tg_login")}</p>}
    </div>
  );
}
