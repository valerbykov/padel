// components/InstallPWA.jsx
// Кнопка «Установить приложение». На Android/desktop Chrome ловит системное
// событие установки; на iOS его нет, поэтому показываем подсказку.
import React, { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

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
    background: "#16291f", border: "1px solid #22382c", borderRadius: 14,
    padding: "10px 14px", color: "#eef3ee", fontSize: 13,
  };

  // iOS: показываем инструкцию (установка только вручную через «Поделиться»).
  if (isIos) {
    return (
      <div style={wrap}>
        <Share size={16} color="#c8ff2d" />
        Установить: нажми «Поделиться» → «На экран «Домой»»
      </div>
    );
  }

  // Android / desktop: кнопка появляется, когда система готова предложить установку.
  if (!promptEvent) return null;
  return (
    <button onClick={install} style={{ ...wrap, cursor: "pointer", background: "#c8ff2d", color: "#0a1612", fontWeight: 700, border: "none" }}>
      <Download size={16} /> Установить приложение
    </button>
  );
}
