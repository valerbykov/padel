// WelcomeScreen.jsx — лёгкий экран «Начало» для ГОСТЯ (без сессии).
// Вынесен из PadelLeague, чтобы гость на лендинге не грузил весь PadelLeague +
// Tournaments (было ~262K лишнего JS на критическом пути Lighthouse). App рендерит
// его напрямую при !session; свой контейнер-обёртка + минимальный набор pl-* стилей
// (глобальные CSS-переменные темы приходят с :root, их дублировать не нужно).
import React, { useState } from "react";
import { t } from "../lib/i18n";
import { DOG_COUNT } from "../lib/avatar";
import { useIsWide } from "./wide/wide";
import Logo from "./Logo";

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
/* ≥900px: широкий hero — два столбца (слева текст+CTA, справа демо-превью).
   Раскладка через grid-column/grid-row на существующих узлах (без reflow DOM,
   без нового wrapper-а) — ряды заданы явно, чтобы не зависеть от эвристик
   авто-расстановки grid (та кладёт «пустые» левые ячейки не туда, куда нужно). */
@media(min-width:900px){
  .wl-root .wl-shell{max-width:1040px !important;padding:56px 32px 72px !important;}
  .wl-root .pl-pop{display:grid;grid-template-columns:1fr 1fr;column-gap:64px;row-gap:20px;align-items:start;}
  .wl-root .wl-hero-text{grid-column:1;grid-row:1;text-align:left !important;padding:0 !important;}
  .wl-root .wl-headline{margin:0 !important;max-width:420px !important;font-size:clamp(34px,3.6vw,50px) !important;}
  .wl-root .wl-subtitle{margin:14px 0 0 !important;max-width:420px !important;}
  .wl-root .wl-demo{grid-column:2;grid-row:1;}
  .wl-root .wl-demohint{grid-column:2;grid-row:2;}
  .wl-root .wl-features{grid-column:2;grid-row:3;}
  .wl-root .wl-cta{grid-column:1;grid-row:2;}
  .wl-root .wl-codehint{grid-column:1;grid-row:3;}
  .wl-root .wl-about{grid-column:1;grid-row:4;}
  .wl-root .wl-controls{grid-column:1/-1;grid-row:5;margin-top:28px !important;}
}
`;

export default function WelcomeScreen({ onLogin, onOpenLanding, theme = "dark", lang = "ru", onThemeToggle, onLangChange }) {
  const isWide = useIsWide();     // ≥900: десктопный hero с подложкой-кортом
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
  // Десктоп ≥900: асимметричный hero с подложкой-кортом (реальный
  // /padel-court.png, затемнён), подиум-собаки справа, верхний нав с
  // языком/темой/о-проекте. Мобильная версия ниже — без изменений.
  const deskCss = `
.wl-desk .wld-page{position:relative;overflow:hidden;min-height:100vh;background:var(--bg);}
.wl-desk .wld-court{position:absolute;inset:0;z-index:0;background:url(/padel-court.png) center/cover;filter:brightness(.34) saturate(.72);}
.wl-desk.wl-light .wld-court{filter:brightness(.95) saturate(.85);opacity:.45;}
.wl-desk .wld-tint{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(ellipse at 74% 42%, color-mix(in srgb,var(--lime) 12%,transparent), transparent 52%),linear-gradient(180deg, color-mix(in srgb,var(--bg) 58%,transparent), color-mix(in srgb,var(--bg) 80%,transparent) 55%, var(--bg));}
.wl-desk .wld-nav{position:relative;z-index:3;display:flex;align-items:center;padding:20px 40px;border-bottom:1px solid var(--line);}
.wl-desk .wld-brand{display:flex;align-items:center;gap:9px;font-weight:800;font-size:18px;}
.wl-desk .wld-brand b{color:var(--lime);}
.wl-desk .wld-paw{width:30px;height:30px;border-radius:9px;background:var(--lime);color:var(--lime-fg);display:grid;place-items:center;font-size:15px;}
.wl-desk .wld-navr{margin-left:auto;display:flex;align-items:center;gap:8px;}
.wl-desk .wld-pill{border:1px solid var(--line);border-radius:10px;padding:6px 11px;font-size:12px;font-weight:700;color:var(--ink);background:var(--surface2);cursor:pointer;font-family:'Outfit',sans-serif;}
.wl-desk .wld-link{border:none;background:none;color:var(--mut);font-size:13.5px;font-weight:600;padding:7px 10px;cursor:pointer;font-family:'Outfit',sans-serif;}
.wl-desk .wld-hero{position:relative;z-index:3;display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,.95fr);gap:56px;align-items:center;max-width:1240px;margin:0 auto;padding:min(90px,8vh) 48px;}
.wl-desk .wld-left{max-width:600px;}
.wl-desk .wld-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--lime);margin-bottom:20px;}
.wl-desk .wld-dot{width:7px;height:7px;border-radius:50%;background:var(--lime);box-shadow:0 0 10px var(--lime);}
.wl-desk .wld-h1{font-weight:800;font-size:clamp(36px,4.3vw,58px);line-height:1.0;letter-spacing:-1.4px;margin:0;}
.wl-desk .wld-h1 .g{color:var(--lime);}
.wl-desk .wld-sub{margin-top:20px;font-size:18px;line-height:1.5;color:var(--mut);max-width:480px;}
.wl-desk .wld-cta{margin-top:28px;width:auto;min-width:260px;padding:16px 26px;font-size:16px;display:inline-flex;align-items:center;justify-content:center;gap:8px;}
.wl-desk .wld-codehint{margin-top:14px;font-size:13px;color:var(--mut);max-width:430px;line-height:1.5;}
.wl-desk .wld-right{display:flex;justify-content:center;}
.wl-desk .wld-stage{position:relative;width:100%;max-width:420px;background:linear-gradient(180deg, color-mix(in srgb,var(--surface) 72%,transparent), color-mix(in srgb,var(--bg) 82%,transparent));border:1px solid var(--line);border-radius:22px;padding:22px 22px 0;box-shadow:0 40px 90px -34px #000;backdrop-filter:blur(3px);}
.wl-desk .wld-glow{position:absolute;left:50%;bottom:52px;width:200px;height:120px;transform:translateX(-50%);background:radial-gradient(ellipse at center, color-mix(in srgb,var(--lime) 30%,transparent), transparent 68%);filter:blur(6px);pointer-events:none;}
.wl-desk .wld-pod{position:relative;display:flex;align-items:flex-end;justify-content:center;gap:16px;}
.wl-desk .wld-p{display:flex;flex-direction:column;align-items:center;min-width:0;}
.wl-desk .wld-p img{border-radius:50%;object-fit:cover;border:3px solid var(--line);background:var(--surface);}
.wl-desk .wld-nm{font-weight:700;margin-top:7px;white-space:nowrap;font-size:12.5px;color:var(--mut);}
.wl-desk .wld-p1 .wld-nm{font-size:15px;color:var(--ink);}
.wl-desk .wld-badge{font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px;background:color-mix(in srgb,#ff9f2d 20%,transparent);color:#ff9f2d;margin-top:4px;}
.wl-desk .wld-ped{border-radius:10px 10px 0 0;font-weight:800;display:grid;place-items:center;margin-top:8px;width:82px;background:var(--surface2);font-size:20px;}
.wl-desk .wld-p1 .wld-ped{height:92px;font-size:26px;background:color-mix(in srgb,var(--yellow) 20%,var(--surface2));}
.wl-desk .wld-p2 .wld-ped{height:62px;}
.wl-desk .wld-p3 .wld-ped{height:44px;}
.wl-desk .wld-cap{text-align:center;padding:14px 0 18px;font-size:11.5px;color:var(--mut);}
`;
  if (isWide) return (
    <div className={`wl-root wl-desk${theme === "light" ? " wl-light" : ""}`}>
      <style>{css}</style>
      <style>{deskCss}</style>
      <div className="wld-page">
        <div className="wld-court" />
        <div className="wld-tint" />
        <div className="wld-nav">
          <div className="wld-brand"><Logo height={26} /></div>
          <div className="wld-navr">
            <button className="wld-pill" onClick={() => { const o = ["ru", "en", "es"]; onLangChange?.(o[(o.indexOf(lang) + 1) % o.length]); }}>{lang.toUpperCase()} <span style={{ color: "var(--mut)", fontWeight: 400 }}>↻</span></button>
            <button className="wld-pill" onClick={onThemeToggle} aria-label={t("aria_theme")}>{theme === "dark" ? "☀️" : "🌙"}</button>
            {onOpenLanding && <button className="wld-link" onClick={onOpenLanding}>{t("lp_about")}</button>}
          </div>
        </div>
        <div className="wld-hero">
          <div className="wld-left">
            <div className="wld-eyebrow"><span className="wld-dot" />{t("tagline")}</div>
            <h1 className="wld-h1">{t("wl_slogan_main")} <span className="g">{t("wl_slogan_accent")}</span></h1>
            <div className="wld-sub">{t("welcome_tagline")}</div>
            <button className="pl-btn wld-cta" onClick={onLogin}>{t("welcome_cta")}</button>
            <div className="wld-codehint">{t("welcome_code_hint")}</div>
          </div>
          <div className="wld-right">
            <div className="wld-stage">
              <div className="wld-glow" />
              <div className="wld-pod">
                {[
                  { n: 2, img: podDogs[1], nm: t("w_pn2"), size: 64, col: "#cfd8d0" },
                  { n: 1, img: podDogs[0], nm: t("w_pn1"), size: 92, col: "var(--yellow)" },
                  { n: 3, img: podDogs[2], nm: t("w_pn3"), size: 64, col: "#cd7f4d" },
                ].map((c) => (
                  <div key={c.n} className={`wld-p wld-p${c.n}`}>
                    <img src={`/avatars/${c.img}-sm.webp`} alt="" decoding="async" fetchPriority={c.n === 1 ? "high" : undefined} style={{ width: c.size, height: c.size, borderColor: c.col }} />
                    <div className="wld-nm">{c.nm}{c.n === 1 ? " · 1204" : ""}</div>
                    {c.n === 1 && <div className="wld-badge">{t("tier_leader")}</div>}
                    <div className="wld-ped" style={{ color: c.col }}>{c.n}</div>
                  </div>
                ))}
              </div>
              <div className="wld-cap">{t("w_pod_hint")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`wl-root${theme === "light" ? " wl-light" : ""}`}>
      <style>{css}</style>
      <div className="wl-shell" style={{ maxWidth: 460, margin: "0 auto", padding: "10px 16px calc(24px + env(safe-area-inset-bottom))" }}>
        <div className="pl-pop">
          {/* Hero — слоган сразу сверху; «стаю» показывает подиум ниже (вариант A).
              ≥900px: этот блок уезжает в левую колонку grid (см. .wl-hero-text в css). */}
          <div className="wl-hero-text" style={{ textAlign: "center", padding: "24px 0 18px" }}>
            {(() => {
              const [a, b] = t("tagline").split(" · ");
              const cap = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);
              return (
                <div className="wl-headline" style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 30, lineHeight: 1.18, letterSpacing: "-0.5px", maxWidth: 340, margin: "0 auto" }}>
                  <span style={{ color: "var(--lime)" }}>{cap(a)}</span>
                  {b && <><span style={{ color: "var(--mut)", fontWeight: 500 }}> ·</span><span style={{ color: "var(--ink)", display: "block" }}>{cap(b)}</span></>}
                </div>
              );
            })()}
            <div className="wl-subtitle" style={{ fontSize: 14, color: "var(--mut)", lineHeight: 1.6, maxWidth: 270, margin: "14px auto 0" }}>
              {t("welcome_tagline")}
            </div>
          </div>

          {/* Живой мини-подиум: продукт виден до входа; собаки — те же, что в демо-стае.
              ≥900px: правая колонка grid — демо-тизер (см. .wl-demo/.wl-demohint/.wl-features). */}
          <div className="pl-card wl-demo" style={{ padding: "14px 12px 0", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 12 }}>
              {[
                { n: 2, img: podDogs[1], nm: t("w_pn2"), size: 42, pad: 10, col: "#cfd8d0" },
                { n: 1, img: podDogs[0], nm: t("w_pn1"), size: 52, pad: 15, col: "var(--yellow)" },
                { n: 3, img: podDogs[2], nm: t("w_pn3"), size: 42, pad: 6, col: "#cd7f4d" },
              ].map((c) => (
                <div key={c.n} style={{ textAlign: "center", minWidth: 0 }}>
                  <img src={`/avatars/${c.img}-sm.webp`} alt="" decoding="async" fetchPriority={c.n === 1 ? "high" : undefined}
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
          <div className="wl-demohint" style={{ textAlign: "center", fontSize: 11.5, color: "var(--mut)", marginBottom: 14 }}>{t("w_pod_hint")}</div>

          {/* Feature cards */}
          <div className="wl-features" style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
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

          {/* CTA — ≥900px уезжает в левую колонку, к заголовку. */}
          <button className="pl-btn wl-cta" style={{ width: "100%", padding: 15, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={onLogin}>
            {t("welcome_cta")}
          </button>
          <div className="wl-codehint" style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "var(--mut)" }}>
            {t("welcome_code_hint")}
          </div>

          {onOpenLanding && (
            <div className="wl-about" style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={onOpenLanding} style={{ background: "none", border: "none", color: "var(--lime)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>
                {t("lp_about")}
              </button>
            </div>
          )}

          {/* Lang + theme controls — ≥900px во всю ширину внизу hero. */}
          <div className="wl-controls" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 18, flexWrap: "wrap" }}>
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
