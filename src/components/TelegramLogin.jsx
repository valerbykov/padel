// components/TelegramLogin.jsx
// Кнопка «Войти через Telegram». Рендерит официальный виджет Telegram,
// проверяет данные через Edge Function 'telegram-auth' и поднимает сессию.
//
// props:
//   botName   — username бота БЕЗ @ (напр. "padel_league_bot")
//   onSuccess — колбэк после успешного входа
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { t } from "../lib/i18n";
import { isNativeApp } from "../lib/platform";
import { signInTelegramNative } from "../lib/auth";
import { Send } from "lucide-react";

export default function TelegramLogin({ botName, onSuccess }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState(""); // '', 'busy', 'error'
  const [errText, setErrText] = useState("");

  const native = isNativeApp();
  useEffect(() => {
    if (native) return;  // в нативе виджет не грузим — вход через системный браузер
    // Глобальный колбэк, который дёргает виджет Telegram.
    window.__tgAuth = async (user) => {
      setStatus("busy"); setErrText("");
      try {
        // 1. Проверка подписи на сервере + получение одноразового token_hash.
        const { data, error } = await supabase.functions.invoke("telegram-auth", { body: user });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // 2. Меняем одноразовый код на полноценную сессию Supabase.
        let verifyErr = null;
        if (data.email && data.token) {
          const r = await supabase.auth.verifyOtp({ email: data.email, token: data.token, type: "email" });
          verifyErr = r.error;
        } else {
          verifyErr = new Error("no_token");
        }
        // запасной путь — через token_hash
        if (verifyErr && data.token_hash) {
          const r2 = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: "email" });
          verifyErr = r2.error;
        }
        if (verifyErr) throw verifyErr;

        setStatus("");
        onSuccess?.();
      } catch (e) {
        setStatus("error");
        const map = { bad_signature: t("err_tg_signature"), expired: t("err_tg_expired") };
        setErrText(map[e.message] || t("err_tg_login"));
      }
    };

    // Вставляем официальный скрипт-виджет Telegram.
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-onauth", "__tgAuth(user)");
    script.setAttribute("data-request-access", "write");
    containerRef.current?.appendChild(script);

    return () => { try { delete window.__tgAuth; } catch (e) {} };
  }, [botName, onSuccess]);

  if (native) {
    return (
      <div style={{ fontFamily: "'Outfit',sans-serif", textAlign: "center" }}>
        <button onClick={() => signInTelegramNative()}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", borderRadius: 12, border: "none", cursor: "pointer", background: "#29a9eb", color: "#fff", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 15 }}>
          <Send size={17} /> {t("tg_login_btn")}
        </button>
      </div>
    );
  }
  return (
    <div style={{ fontFamily: "'Outfit',sans-serif", textAlign: "center" }}>
      <div ref={containerRef} />
      {status === "busy" && <p style={{ color: "var(--mut)", fontSize: 13 }}>{t("tg_signing")}</p>}
      {status === "error" && <p style={{ color: "#ff6a52", fontSize: 13 }}>{errText}</p>}
    </div>
  );
}
