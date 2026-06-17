// components/LeaguePublicPage.jsx
// Публичная страница лиги /l/:code — без авторизации.
// Показывает рейтинг игроков, кнопку «Вступить» и вирусный CTA «Создать лигу».
import React, { useEffect, useState } from "react";
import { getPublicLeague } from "../lib/padelApi";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.lp-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;
 background-image:radial-gradient(circle at 80% -10%,rgba(200,255,45,.12),transparent 45%),radial-gradient(circle at 0% 110%,rgba(40,120,90,.18),transparent 40%);}
.lp-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;}
.lp-d{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;}
.lp-join-btn{display:block;width:100%;padding:17px;background:var(--lime);color:#0a1612;border:none;border-radius:16px;
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
    <img src={url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "1.5px solid var(--line)", flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `hsl(${hue}deg 55% 30%)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: Math.round(size * 0.36), flexShrink: 0, border: "1.5px solid var(--line)" }}>
      {initials}
    </div>
  );
}

export default function LeaguePublicPage({ code }) {
  const [league, setLeague] = useState(undefined);
  const [err,    setErr]    = useState(null);

  useEffect(() => {
    getPublicLeague(code)
      .then(setLeague)
      .catch(() => { setErr("Лига не найдена"); setLeague(null); });
  }, [code]);

  const joinUrl   = `${window.location.origin}/?join=${code}`;
  const createUrl = window.location.origin;

  return (
    <div className="lp-root">
      <style>{css}</style>
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "32px 16px 56px" }}>

        {/* Брендинг */}
        <div style={{ color: "var(--lime)", fontSize: 11, fontWeight: 700, letterSpacing: 3, marginBottom: 24 }}>
          🎾 ПАДЕЛ · ЛИГА ДРУЗЕЙ
        </div>

        {/* Загрузка / ошибка */}
        {league === undefined && (
          <div style={{ color: "var(--mut)", fontSize: 14 }}>Загрузка…</div>
        )}
        {err && (
          <div className="lp-card" style={{ padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🏓</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Лига не найдена</div>
            <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 18 }}>
              Проверь ссылку или попроси организатора прислать новую.
            </div>
            <a href={createUrl} className="lp-join-btn" style={{ fontSize: 15 }}>
              Создать свою лигу →
            </a>
          </div>
        )}

        {league && (
          <>
            {/* Название лиги */}
            <div className="lp-d" style={{ fontSize: 38, lineHeight: 1, marginBottom: 6, color: "var(--ink)" }}>
              {league.name}
            </div>
            <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 28 }}>
              {league.member_count} {noun(league.member_count, "игрок", "игрока", "игроков")}
            </div>

            {/* Заголовок таблицы */}
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--mut)", letterSpacing: 2, marginBottom: 10 }}>
              РЕЙТИНГ
            </div>

            {/* Лидерборд */}
            <div className="lp-card" style={{ marginBottom: 20, overflow: "hidden" }}>
              {(league.members || []).length === 0 && (
                <div style={{ padding: 20, textAlign: "center", color: "var(--mut)", fontSize: 13 }}>
                  Игроков пока нет
                </div>
              )}
              {(league.members || []).map((p, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                  borderBottom: i < league.members.length - 1 ? "1px solid var(--line)" : "none",
                  background: i < 3 ? `rgba(${i===0?'255,210,63':i===1?'207,216,208':'205,127,77'},.04)` : "transparent",
                }}>
                  <span className="lp-d" style={{ width: 18, fontSize: 16, color: MEDALS[i] || "var(--mut)", flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <Avatar name={p.name} url={p.avatar_url} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--mut)" }}>
                      {p.matches} {noun(p.matches, "игра", "игры", "игр")} · {p.wins} {noun(p.wins, "победа", "победы", "побед")}
                    </div>
                  </div>
                  <div className="lp-d" style={{ fontSize: 22, color: "var(--lime)", flexShrink: 0 }}>
                    {p.rating}
                  </div>
                </div>
              ))}
            </div>

            {/* Кнопка вступить */}
            <a href={joinUrl} className="lp-join-btn" style={{ marginBottom: 12 }}>
              Вступить в лигу →
            </a>
            <div style={{ fontSize: 12, color: "var(--mut)", textAlign: "center", marginBottom: 28 }}>
              После входа в аккаунт тебя автоматически добавят в лигу
            </div>

            {/* Вирусный CTA */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 22, textAlign: "center" }}>
              <div className="lp-d" style={{ fontSize: 13, color: "var(--mut)", marginBottom: 10, letterSpacing: 1 }}>
                ХОЧЕШЬ СВОЮ ЛИГУ?
              </div>
              <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 14, lineHeight: 1.5 }}>
                Рейтинги, американо-турниры, история игр — бесплатно для любой компании.
              </div>
              <a href={createUrl} style={{ color: "var(--lime)", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                Создать свою лигу →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
