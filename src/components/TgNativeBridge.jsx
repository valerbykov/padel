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
        // Одноразовые token/token_hash → в приложение по deep link. Сессию поднимет
        // именно приложение (не этот браузер), чтобы она оказалась в нативе.
        const p = new URLSearchParams();
        p.set("tgauth", "1");
        if (data.email) p.set("email", data.email);
        if (data.token) p.set("tk", data.token);
        if (data.token_hash) p.set("th", data.token_hash);
        setStatus("done");
        window.location.href = `${NATIVE_REDIRECT}?${p.toString()}`;
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
