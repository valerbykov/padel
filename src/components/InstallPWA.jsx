// components/InstallPWA.jsx
// Кнопка «Установить приложение». На Android/desktop Chrome ловит системное
// событие установки; на iOS его нет, поэтому показываем подсказку.
import React, { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { t } from "../lib/i18n";

export default function InstallPWA() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(false);

  // iOS Safari не поддерживает beforeinstallprompt — определяем отдельно.
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const inStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone;

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPromptEvent(e); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || inStandalone) return null;

  const install = async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  };

  const wrap = {
    fontFamily: "'Outfit',sans-serif", display: "flex", alignItems: "center", gap: 8,
    background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 14,
    padding: "10px 14px", color: "var(--ink)", fontSize: 13,
  };

  // iOS: показываем инструкцию (установка только вручную через «Поделиться»).
  if (isIos) {
    return (
      <div style={wrap}>
        <Share size={16} color="var(--lime)" />
        {t("pwa_install_ios")}
      </div>
    );
  }

  // Android / desktop: кнопка появляется, когда система готова предложить установку.
  if (!promptEvent) return null;
  return (
    <button onClick={install} style={{ ...wrap, cursor: "pointer", background: "var(--lime)", color: "var(--lime-fg)", fontWeight: 700, border: "none" }}>
      <Download size={16} /> {t("pwa_install_btn")}
    </button>
  );
}
