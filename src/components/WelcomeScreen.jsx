// WelcomeScreen.jsx — лёгкий экран «Начало» для ГОСТЯ (без сессии).
// Вынесен из PadelLeague, чтобы гость на лендинге не грузил весь PadelLeague +
// Tournaments (было ~262K лишнего JS на критическом пути Lighthouse). App рендерит
// его напрямую при !session; свой контейнер-обёртка + минимальный набор pl-* стилей
// (глобальные CSS-переменные темы приходят с :root, их дублировать не нужно).
import React, { useState } from "react";
import { t } from "../lib/i18n";
import { DOG_COUNT } from "../lib/avatar";

// Переменные темы задаём на своём корне (как остальные standalone-экраны —
// LoginScreen/GuestJoin/ProfileEditor): body-переменные PadelLeague гостю не
// приходят, т.к. PadelLeague не смонтирован. + минимум классов pl-card/pl-btn/pl-pop.
const css = `
.wl-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;--lime-fg:#0a1612;--yellow:#ffd23f;font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;color-scheme:dark;}
.wl-root.wl-light{--bg:#f2f7f4;--surface:#ffffff;--surface2:#e6f0ea;--line:#c4d9cc;--ink:#0d1f18;--mut:#4a7060;--lime:#2a7a00;--coral:#d93a1f;--lime-fg:#ffffff;--yellow:#9a6800;color-scheme:light;background-image:radial-gradient(circle at 80% -10%,rgba(42,122,0,.06),transparent 45%),radial-gradient(circle at 0% 110%,rgba(40,120,90,.08),transparent 40%);}
.wl-root .pl-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;}
.wl-root .pl-btn{background:var(--lime);color:var(--lime-fg);font-weight:700;border:none;border-radius:14px;cursor:pointer;transition:transform .12s,filter .15s,box-shadow .15s;}
.wl-root .pl-btn:hover:not(:disabled){filter:brightness(1.05);box-shadow:0 6px 18px -8px color-mix(in srgb,var(--lime) 70%,transparent);}
.wl-root .pl-btn:active{transform:scale(.97);}
.wl-root .pl-pop{animation:pop .35s cubic-bezier(.2,.8,.2,1) both;}
@keyframes pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media(max-width:400px){.wl-root .pl-card{border-radius:14px;}}
`;

export default function WelcomeScreen({ onLogin, onOpenLanding, theme = "dark", lang = "ru", onThemeToggle, onLangChange }) {
  // Собаки подиума — случайные из 15 при каждом заходе (как раньше верхний ряд);
  // выбор один раз на маунт, чтобы не мигали при ререндерах.
  const [podDogs] = useState(() => {
    const nums = Array.from({ length: DOG_COUNT }, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
    return nums.slice(0, 3).map((n) => `dog-${String(n).padStart(2, "0")}`);
  });
  // Три ёмкие карточки: демо теперь продаёт живой подиум ниже, а не текст.
  const features = [
    { icon: "🏆", title: t("w_f1_t"), sub: t("w_f1_d") },   // создай/вступи
    { icon: "🔗", title: t("w_f2_t"), sub: t("w_f2_d") },   // ссылки, LIVE, напоминания
    { icon: "📸", title: t("w_f3_t"), sub: t("w_f3_d") },   // рейтинг, звания, карточки
  ];
  return (
    <div className={`wl-root${theme === "light" ? " wl-light" : ""}`}>
      <style>{css}</style>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "10px 16px calc(24px + env(safe-area-inset-bottom))" }}>
        <div className="pl-pop">
          {/* Hero — слоган сразу сверху; «стаю» показывает подиум ниже (вариант A). */}
          <div style={{ textAlign: "center", padding: "24px 0 18px" }}>
            {(() => {
              const [a, b] = t("tagline").split(" · ");
              const cap = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);
              return (
                <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 30, lineHeight: 1.18, letterSpacing: "-0.5px", maxWidth: 340, margin: "0 auto" }}>
                  <span style={{ color: "var(--lime)" }}>{cap(a)}</span>
                  {b && <><span style={{ color: "var(--mut)", fontWeight: 500 }}> ·</span><span style={{ color: "var(--ink)", display: "block" }}>{cap(b)}</span></>}
                </div>
              );
            })()}
            <div style={{ fontSize: 14, color: "var(--mut)", lineHeight: 1.6, maxWidth: 270, margin: "14px auto 0" }}>
              {t("welcome_tagline")}
            </div>
          </div>

          {/* Живой мини-подиум: продукт виден до входа; собаки — те же, что в демо-стае */}
          <div className="pl-card" style={{ padding: "14px 12px 0", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 12 }}>
              {[
                { n: 2, img: podDogs[1], nm: t("w_pn2"), size: 42, pad: 10, col: "#cfd8d0" },
                { n: 1, img: podDogs[0], nm: t("w_pn1"), size: 52, pad: 15, col: "var(--yellow)" },
                { n: 3, img: podDogs[2], nm: t("w_pn3"), size: 42, pad: 6, col: "#cd7f4d" },
              ].map((c) => (
                <div key={c.n} style={{ textAlign: "center", minWidth: 0 }}>
                  <img src={`/avatars/${c.img}.webp`} alt="" loading="lazy" decoding="async"
                    style={{ width: c.size, height: c.size, borderRadius: "50%", objectFit: "cover", border: `3px solid ${c.col}`, background: "var(--surface)" }} />
                  <div style={{ fontSize: c.n === 1 ? 12 : 11, fontWeight: c.n === 1 ? 700 : 600, marginTop: 3 }}>{c.nm}{c.n === 1 ? " · 1204" : ""}</div>
                  {c.n === 1 && (
                    <div style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 20, background: "color-mix(in srgb, #ff9f2d 18%, transparent)", color: "#ff9f2d", display: "inline-block", marginTop: 2 }}>{t("tier_leader")}</div>
                  )}
                  <div style={{ background: c.n === 1 ? "color-mix(in srgb, var(--yellow) 18%, var(--surface2))" : "var(--surface2)", borderRadius: "8px 8px 0 0", padding: `${c.pad}px 16px`, fontWeight: 800, color: c.col, marginTop: 4 }}>{c.n}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--mut)", marginBottom: 14 }}>{t("w_pod_hint")}</div>

          {/* Feature cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
            {features.map(({ icon, title, sub }) => (
              <div key={title} className="pl-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px" }}>
                <div style={{ fontSize: 24, flexShrink: 0, width: 32, textAlign: "center" }}>{icon}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
                  <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 2 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button className="pl-btn" style={{ width: "100%", padding: 15, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={onLogin}>
            {t("welcome_cta")}
          </button>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "var(--mut)" }}>
            {t("welcome_code_hint")}
          </div>

          {onOpenLanding && (
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={onOpenLanding} style={{ background: "none", border: "none", color: "var(--lime)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>
                {t("lp_about")}
              </button>
            </div>
          )}

          {/* Lang + theme controls */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 18, flexWrap: "wrap" }}>
            <button onClick={() => { const o = ["ru", "en", "es"]; onLangChange?.(o[(o.indexOf(lang) + 1) % o.length]); }} style={{
              border: "1px solid var(--line)", borderRadius: 10, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
              background: "var(--surface2)", color: "var(--ink)", fontFamily: "'Outfit',sans-serif", display: "flex", alignItems: "center", gap: 6,
            }}>{lang.toUpperCase()} <span style={{ color: "var(--mut)", fontWeight: 400 }}>↻</span></button>
            <button onClick={onThemeToggle} style={{
              border: "1px solid var(--line)", borderRadius: 10, padding: "5px 9px",
              background: "var(--surface2)", color: "var(--mut)", cursor: "pointer",
              display: "flex", alignItems: "center", fontFamily: "'Outfit',sans-serif",
            }}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
