// components/Landing.jsx
// Встроенный лендинг для гостей — первый экран приложения до входа.
// «Начать» → экран входа (onStart), «Посмотреть приложение» → внутрь (onBrowse).
// Самодостаточен по теме: как и LoginScreen, объявляет свои CSS-переменные на
// .ld-root, потому что рендерится отдельной веткой (PadelLeague ещё не смонтирован
// и не задал переменные на body).
import React from "react";
import { Sun, Moon, ArrowRight, Link2, Trophy, Medal } from "lucide-react";
import { t } from "../lib/i18n";

const darkVars = "--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;--lime-fg:#0a1612;";
const lightVars = "--bg:#f2f7f4;--surface:#ffffff;--surface2:#e6f0ea;--line:#c4d9cc;--ink:#0d1f18;--mut:#4a7060;--lime:#2a7a00;--coral:#d93a1f;--lime-fg:#ffffff;";

const css = (isLight) => `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700;800&display=swap');
.ld-root{${isLight ? lightVars : darkVars}
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100svh;display:flex;flex-direction:column;
 background-image:radial-gradient(circle at 82% -8%,${isLight ? "rgba(42,122,0,.07)" : "rgba(200,255,45,.12)"},transparent 44%),radial-gradient(circle at -5% 16%,${isLight ? "rgba(40,120,90,.08)" : "rgba(40,120,90,.20)"},transparent 42%);}
.ld-top{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line);
 background:color-mix(in srgb,var(--bg) 80%,transparent);position:sticky;top:0;z-index:5;backdrop-filter:blur(10px);}
.ld-brand{display:flex;align-items:center;gap:9px;}
.ld-brand img{width:28px;height:28px;border-radius:8px;}
.ld-word{font-family:'Outfit';font-weight:800;letter-spacing:-.5px;font-size:19px;line-height:1;}
.ld-word .a{color:var(--lime);} .ld-word .b{color:var(--ink);}
.ld-icbtn{background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:6px 10px;cursor:pointer;
 color:var(--mut);font-family:'Outfit';font-size:12px;font-weight:700;display:flex;align-items:center;gap:5px;}
.ld-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px 40px;gap:26px;}
.ld-hero{width:100%;max-width:440px;text-align:center;display:flex;flex-direction:column;align-items:center;}
.ld-pill{display:inline-flex;align-items:center;gap:8px;background:color-mix(in srgb,var(--lime) 13%,transparent);
 border:1px solid color-mix(in srgb,var(--lime) 35%,transparent);color:var(--lime);font-weight:600;font-size:12.5px;
 padding:6px 13px;border-radius:999px;margin-bottom:18px;}
.ld-pill .dot{width:7px;height:7px;border-radius:50%;background:var(--lime);box-shadow:0 0 0 4px color-mix(in srgb,var(--lime) 22%,transparent);}
.ld-title{font-family:'Outfit';font-weight:800;letter-spacing:-.5px;line-height:1.04;font-size:clamp(34px,9vw,46px);margin:0 0 14px;}
.ld-title .hl{color:var(--lime);}
.ld-sub{color:var(--mut);font-size:16px;line-height:1.5;margin:0 0 24px;max-width:380px;}
.ld-cta{display:flex;flex-direction:column;gap:11px;width:100%;max-width:340px;}
.ld-btn{display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer;font-family:'Outfit';font-weight:700;
 border-radius:14px;border:1px solid transparent;padding:14px;font-size:15.5px;transition:transform .12s,filter .15s;}
.ld-btn:hover{transform:translateY(-1px);}
.ld-btn-pri{background:var(--lime);color:var(--lime-fg);}
.ld-btn-gho{background:var(--surface2);color:var(--ink);border-color:var(--line);}
.ld-note{color:var(--mut);font-size:12.5px;margin-top:16px;}
.ld-feats{width:100%;max-width:440px;display:flex;flex-direction:column;gap:10px;}
.ld-feat{display:flex;align-items:center;gap:13px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 16px;}
.ld-feat .fic{width:42px;height:42px;border-radius:12px;flex-shrink:0;background:color-mix(in srgb,var(--lime) 14%,transparent);
 display:flex;align-items:center;justify-content:center;color:var(--lime);}
.ld-feat h4{margin:0 0 2px;font-size:15px;font-weight:700;}
.ld-feat p{margin:0;font-size:13px;color:var(--mut);}
.ld-more{color:var(--lime);font-weight:600;font-size:14px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;margin-top:4px;}
.ld-more:hover{text-decoration:underline;}
`;

export default function Landing({ theme = "dark", lang = "ru", onStart, onBrowse, onThemeToggle, onLangChange }) {
  const isLight = theme === "light";
  const cycleLang = () => { const o = ["ru", "en", "es"]; onLangChange?.(o[(o.indexOf(lang) + 1) % o.length]); };

  const feats = [
    { Icon: Link2, t: t("lp_f1_t"), d: t("lp_f1_d") },
    { Icon: Trophy, t: t("lp_f2_t"), d: t("lp_f2_d") },
    { Icon: Medal, t: t("lp_f3_t"), d: t("lp_f3_d") },
  ];

  return (
    <div className="ld-root">
      <style>{css(isLight)}</style>

      <div className="ld-top">
        <div className="ld-brand">
          <img src={isLight ? "/logo-mark-light.png" : "/logo-mark-dark.png"} alt="PadelPack" />
          <span className="ld-word"><span className="a">Padel</span><span className="b">Pack</span></span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="ld-icbtn" onClick={cycleLang}>{lang.toUpperCase()} <span style={{ opacity: .6, fontWeight: 400 }}>↻</span></button>
          <button className="ld-icbtn" onClick={onThemeToggle} style={{ padding: "6px 9px" }}>
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      <div className="ld-body">
        <div className="ld-hero">
          <div className="ld-pill"><span className="dot" />{t("lp_pill")}</div>
          <h1 className="ld-title">{t("lp_title_pre")}<span className="hl">{t("lp_title_hl")}</span>{t("lp_title_post")}</h1>
          <p className="ld-sub">{t("lp_sub")}</p>
          <div className="ld-cta">
            <button className="ld-btn ld-btn-pri" onClick={onStart}>{t("lp_start")} <ArrowRight size={17} /></button>
            <button className="ld-btn ld-btn-gho" onClick={onBrowse}>{t("lp_browse")}</button>
          </div>
          <div className="ld-note">{t("lp_note")}</div>
        </div>

        <div className="ld-feats">
          {feats.map(({ Icon, t: title, d }, i) => (
            <div className="ld-feat" key={i}>
              <span className="fic"><Icon size={20} /></span>
              <div><h4>{title}</h4><p>{d}</p></div>
            </div>
          ))}
        </div>

        <a className="ld-more" href="/landing.html">{t("lp_about")}</a>
      </div>
    </div>
  );
}
