// components/LeaguePublicPage.jsx
// Публичная страница лиги /l/:code — без авторизации.
// Показывает рейтинг игроков, кнопку «Вступить» и вирусный CTA «Создать лигу».
import React, { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { getPublicLeague } from "../lib/padelApi";
import { t, nGames } from "../lib/i18n";
import { avatarFallback } from "../lib/avatar";
import { usePublicChrome, PublicToggles, plural } from "./publicChrome";
import Logo from "./Logo";
import LeagueLogo from "./LeagueLogo";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.lp-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;--yellow:#ffd23f;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;
 background-image:radial-gradient(circle at 80% -10%,rgba(200,255,45,.12),transparent 45%),radial-gradient(circle at 0% 110%,rgba(40,120,90,.18),transparent 40%);}
.lp-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;}
.lp-d{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;}
.lp-join-btn{display:block;width:100%;padding:17px;background:var(--lime);color:var(--lime-fg);border:none;border-radius:16px;
 font-family:'Outfit',sans-serif;font-weight:800;font-size:17px;text-align:center;text-decoration:none;
 cursor:pointer;box-sizing:border-box;transition:filter .12s;}
.lp-join-btn:hover{filter:brightness(1.08);}
`;

const MEDALS = ["#ffd23f", "#cfd8d0", "#cd7f4d"];

function noun(n, one, few, many) {
  const m = Math.abs(n) % 100, m1 = m % 10;
  if (m > 10 && m < 20) return many;
  if (m1 > 1 && m1 < 5) return few;
  if (m1 === 1) return one;
  return many;
}

function Avatar({ name = "", url, size = 38 }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return url ? (
    <img src={url} onError={avatarFallback(name)} alt="" loading="lazy" decoding="async" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "1.5px solid var(--line)", flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `hsl(${hue}deg 55% 30%)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: Math.round(size * 0.36), flexShrink: 0, border: "1.5px solid var(--line)" }}>
      {initials}
    </div>
  );
}

export default function LeaguePublicPage({ code }) {
  const [league, setLeague] = useState(undefined);
  const [err,    setErr]    = useState(null);
  const { theme, lang, vars, toggleTheme, cycleLang } = usePublicChrome();

  useEffect(() => {
    getPublicLeague(code)
      .then(setLeague)
      .catch(() => { setErr(t("err_league_not_found")); setLeague(null); });
  }, [code]);

  const joinUrl   = `${window.location.origin}/?join=${code}`;
  const createUrl = window.location.origin;

  return (
    <div className="lp-root" style={vars}>
      <style>{css}</style>
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "20px 16px 56px" }}>
        <PublicToggles theme={theme} lang={lang} onTheme={toggleTheme} onLang={cycleLang} />

        {/* Брендинг */}
        <div style={{ marginBottom: 22 }}><Logo height={24} /></div>

        {/* Загрузка / ошибка */}
        {league === undefined && (
          <div style={{ color: "var(--mut)", fontSize: 14 }}>{t("pub_loading")}</div>
        )}
        {err && (
          <div className="lp-card" style={{ padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🏓</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("pub_league_notfound_t")}</div>
            <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 18 }}>
              {t("pub_league_notfound_s")}
            </div>
            <a href={createUrl} className="lp-join-btn" style={{ fontSize: 15 }}>
              {t("pub_create_own")}
            </a>
          </div>
        )}

        {league && (
          <>
            {/* Название лиги + логотип клуба */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: league.telegram_url ? 12 : 28 }}>
              {league.logo_url && <LeagueLogo url={league.logo_url} name={league.name} size={60} radius={16} />}
              <div style={{ minWidth: 0 }}>
                <div className="lp-d" style={{ fontSize: 34, lineHeight: 1.05, marginBottom: 6, color: "var(--ink)" }}>
                  {league.name}
                </div>
                <div style={{ fontSize: 13, color: "var(--mut)" }}>
                  {league.member_count} {plural(league.member_count, "players")}
                </div>
              </div>
            </div>
            {league.telegram_url && (
              <a href={league.telegram_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--lime)", fontWeight: 600, fontSize: 14, textDecoration: "none", marginBottom: 26 }}>
                <Send size={14} /> {t("league_open_channel")}
              </a>
            )}

            {/* Заголовок таблицы */}
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--mut)", letterSpacing: 2, marginBottom: 10 }}>
              {t("pub_members")}
            </div>

            {/* Подиум топ-3 — как на вкладке «Друзья» в приложении */}
            {(league.members || []).length >= 3 && (() => {
              const [p1, p2, p3] = league.members;
              const medal = ["var(--yellow)", "#cfd8d0", "#cd7f4d"];
              const col = (p, rank, size, pad) => (
                <div style={{ textAlign: "center", minWidth: 0, flex: 1, maxWidth: 120 }}>
                  <div style={{ display: "flex", justifyContent: "center" }}><Avatar name={p.name} url={p.avatar_url} size={size} /></div>
                  <div style={{ fontSize: rank === 1 ? 13 : 12, fontWeight: rank === 1 ? 700 : 600, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  {p.rating != null && <div style={{ fontSize: 10.5, color: rank === 1 ? "var(--yellow)" : "var(--mut)", fontWeight: 700 }}>{p.rating}</div>}
                  <div style={{ background: rank === 1 ? "color-mix(in srgb, var(--yellow) 18%, var(--surface2))" : "var(--surface2)", borderRadius: "10px 10px 0 0", padding: `${pad}px 0`, fontWeight: 800, color: medal[rank - 1], marginTop: 6, fontFamily: "'Anton',sans-serif", fontSize: 17 }}>{rank}</div>
                </div>
              );
              return (
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 10, padding: "6px 6px 0", marginBottom: 0 }}>
                  {col(p2, 2, 46, 12)}
                  {col(p1, 1, 58, 20)}
                  {col(p3, 3, 46, 7)}
                </div>
              );
            })()}

            {/* Лидерборд (при подиуме — с 4-го места) */}
            <div className="lp-card" style={{ marginBottom: 20, overflow: "hidden", borderTopLeftRadius: (league.members || []).length >= 3 ? 0 : undefined, borderTopRightRadius: (league.members || []).length >= 3 ? 0 : undefined }}>
              {(league.members || []).length === 0 && (
                <div style={{ padding: 20, textAlign: "center", color: "var(--mut)", fontSize: 13 }}>
                  {t("pub_no_players")}
                </div>
              )}
              {((league.members || []).length >= 3 ? league.members.slice(3) : (league.members || [])).map((p, idx) => {
                const i = (league.members || []).length >= 3 ? idx + 3 : idx;
                const rankColor = ["var(--yellow)", "#cfd8d0", "#cd7f4d"][i] || "var(--mut)";
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 11, padding: "10px 14px",
                    borderBottom: i < league.members.length - 1 ? "1px solid var(--line)" : "none",
                  }}>
                    <div style={{ width: 20, textAlign: "center", fontFamily: "'Anton',sans-serif", fontSize: 17, color: rankColor, flexShrink: 0 }}>{i + 1}</div>
                    <Avatar name={p.name} url={p.avatar_url} id={p.id || p.profile_id} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name}{i === 0 ? " 🥇" : ""}
                      </div>
                    </div>
                    {p.matches > 0 && <div style={{ fontSize: 12, color: "var(--mut)", flexShrink: 0 }}>{nGames(p.matches)}</div>}
                  </div>
                );
              })}
            </div>

            {/* Кнопка вступить */}
            <a href={joinUrl} className="lp-join-btn" style={{ marginBottom: 12 }}>
              {t("pub_join_league")}
            </a>
            <div style={{ fontSize: 12, color: "var(--mut)", textAlign: "center", marginBottom: 28 }}>
              {t("pub_after_login")}
            </div>

            {/* Вирусный CTA */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 22, textAlign: "center" }}>
              <div className="lp-d" style={{ fontSize: 13, color: "var(--mut)", marginBottom: 10, letterSpacing: 1 }}>
                {t("pub_want_own_t")}
              </div>
              <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 14, lineHeight: 1.5 }}>
                {t("pub_want_own_s")}
              </div>
              <a href={createUrl} style={{ color: "var(--lime)", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                {t("pub_create_own")}
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
