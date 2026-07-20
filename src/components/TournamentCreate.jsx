// components/TournamentCreate.jsx
// Мастер создания турнира (2 шага: FormatPicker → конфиг), вынесен из Tournaments.jsx
// в отдельный lazy-чанк, т.к. используется только при открытии формы создания.
import React, { useState, useEffect, useRef } from "react";
import { createTournament } from "../lib/tournamentApi";
import { sanitizeEventLevel } from "../lib/levels";
import { defaultCurrency } from "../lib/region";
import { currencySymbol } from "../lib/money";
import { t as tr } from "../lib/i18n";
import DateTimePicker from "./DateTimePicker";
import DurationPicker from "./DurationPicker";
import LevelPicker from "./LevelPicker";
import Avatar from "./Avatar";
import { showToast } from "./ui-dialogs";
import BackButton from "./BackButton";
import { css, nowLocalDT, fmtById, FormatPicker, loadTrnDraft } from "./Tournaments";

export default function Create({ groupId, profileId, players = [], back, open }) {
  const DRAFT_KEY = `pp_trn_draft_${groupId}`;
  const draftRef = useRef(null);
  if (draftRef.current === null) draftRef.current = loadTrnDraft(DRAFT_KEY);
  const d0 = draftRef.current;

  const [step, setStep] = useState(() => d0.step || "format");
  const [format, setFormat] = useState(() => d0.format ?? null);
  const [courts, setCourts] = useState(() => d0.courts ?? 2);
  const [playerCount, setPlayerCount] = useState(() => d0.playerCount ?? 8);
  const [kotHChampionRule, setKotHChampionRule] = useState(() => d0.kotHChampionRule || "court_1"); // #4: правило чемпиона KotH
  const [points, setPoints] = useState(() => d0.points ?? 32);
  const [openScoring, setOpenScoring] = useState(() => d0.openScoring ?? true); // счёт: по умолчанию свободный (любой участник вводит); можно переключить на PIN
  const [day, setDay] = useState(() => d0.day || nowLocalDT().slice(0, 10));
  const [time, setTime] = useState(() => d0.time || nowLocalDT().slice(11, 16));
  const date = day ? `${day}T${time || "00:00"}` : "";
  const [place, setPlace] = useState(() => d0.place || "");
  const [name, setName] = useState(() => d0.name || "");
  const [durMin, setDurMin] = useState(() => d0.durMin || 120); // длительность вместо времени окончания
  const [description, setDescription] = useState(() => d0.description || "");
  const [contactName, setContactName] = useState(() => d0.contactName || "");
  const [contactLink, setContactLink] = useState(() => d0.contactLink || "");
  const [level, setLevel] = useState(() => d0.level ?? null);
  const [contactFromLeague, setContactFromLeague] = useState(() => d0.contactFromLeague !== false); // по умолчанию — из Лиги
  const [feeAmount, setFeeAmount] = useState(() => d0.feeAmount || ""); // взнос с игрока (пусто = без взноса)
  const [feeTiming, setFeeTiming] = useState(() => d0.feeTiming || "start"); // когда собирать: до старта / после
  const [feeCur, setFeeCur] = useState(() => d0.feeCur || "");
  const [busy, setBusy] = useState(false);
  // Восстановленное из черновика название не должно затираться авто-именем при
  // первом же прогоне эффекта (format уже truthy на восстановлении).
  const skipAutoName = useRef(!!d0.name);

  // Сохраняем черновик при любом изменении полей — переживает уход со вкладки
  // (включая выбранный формат и шаг мастера, чтобы вернуться на тот же экран).
  useEffect(() => {
    const draft = { step, format, courts, playerCount, points, openScoring, kotHChampionRule, day, time, place, name, durMin, description, contactName, contactLink, level, contactFromLeague, feeAmount, feeTiming, feeCur };
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) {}
  }, [step, format, courts, playerCount, points, openScoring, kotHChampionRule, day, time, place, name, durMin, description, contactName, contactLink, level, contactFromLeague, feeAmount, feeTiming, feeCur]);

  // Валюта взноса по региону (async) — только если не восстановлена из черновика.
  useEffect(() => { if (!feeCur) defaultCurrency().then((c) => setFeeCur(c || "EUR")).catch(() => setFeeCur("EUR")); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = format ? fmtById(format) : null;
  const isBtb = format === "beat_the_box";     // единственный формат «один корт + очередь»
  const isKoth = format === "king_of_hill";    // «король корта» — по кортам (игроков/4)

  // Контакт «из Лиги»: карусель участников — я сам первым, затем остальные.
  const meP = players.find((p) => p.id === profileId) || null;
  const contactMembers = meP ? [meP, ...players.filter((p) => p.id !== profileId)] : players;
  const contactHandleOf = (contacts) => contacts ? (contacts.telegram || contacts.phone || contacts.whatsapp || "") : "";

  const POINTS_OPTS = [16, 24, 32, 48, 64];
  const COURTS_OPTS = [
    { v: 2, label: tr("trn_court2"), sub: tr("trn_8players") },
    { v: 3, label: tr("trn_court3"), sub: tr("trn_12players") },
    { v: 4, label: tr("trn_court4"), sub: tr("trn_16players") },
    { v: 5, label: tr("trn_court5"), sub: tr("trn_20players") },
    { v: 6, label: tr("trn_court6"), sub: tr("trn_24players") },
  ];
  const KOTH_PLAYER_OPTS = [
    { v: 4,  label: "4",  sub: tr("trn_teams_2") },
    { v: 6,  label: "6",  sub: tr("trn_teams_3") },
    { v: 8,  label: "8",  sub: tr("trn_teams_4") },
    { v: 10, label: "10", sub: tr("trn_teams_5") },
    { v: 12, label: "12", sub: tr("trn_teams_6") },
  ];

  // Автоназвание = формат + размер. Дата/время НЕ дублируются в названии —
  // дата показывается отдельно в карточке турнира.
  React.useEffect(() => {
    if (!format) return;
    if (skipAutoName.current) { skipAutoName.current = false; return; }
    try {
      if (isBtb) {
        const teams = playerCount / 2;
        setName(`${fmt.name} · ${teams} ${tr("trn_teams_" + teams).split(" ")[1] || "teams"}`);
      } else {
        const c = COURTS_OPTS.find((o) => o.v === courts);
        if (!c) return;
        setName(`${fmt.name} · ${c.label}`);
      }
    } catch (e) {}
  }, [courts, playerCount, format]);

  const go = async () => {
    setBusy(true);
    try {
      const targetSize = isBtb ? playerCount : courts * 4;
      // Сохраняем КОНКРЕТНЫЙ момент (ISO с таймзоной), чтобы введённое локальное
      // время совпадало с показанным при чтении (без сдвига часовых поясов).
      let startsAtIso = null;
      try { if (date) startsAtIso = new Date(date).toISOString(); } catch (e) { startsAtIso = null; }
      // Окончание = начало + выбранная длительность.
      let endsAtIso = null;
      try { endsAtIso = new Date(new Date(`${day}T${time}`).getTime() + durMin * 60000).toISOString(); } catch (e) { endsAtIso = null; }
      const trn = await createTournament(groupId, { name: name.trim() || null, pointsPerGame: points, targetSize, format, createdBy: profileId, startsAt: startsAtIso, endsAt: endsAtIso, place, description: description.trim() || null, contactName: contactName.trim() || null, contactLink: contactLink.trim() || null, kotHChampionRule: isKoth ? kotHChampionRule : undefined, openScoring, level: sanitizeEventLevel(level), feePerPlayer: Number(feeAmount) || null, feeCurrency: feeCur, feeTiming });
      try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) {}
      open(trn.id);
    } catch (e) { showToast(tr("err_create_tour")); setBusy(false); }
  };

  const chip = (active) => ({
    padding: "10px 0", textAlign: "center", borderRadius: 12, cursor: "pointer",
    fontWeight: 600, fontSize: 13, border: "none",
    background: active ? "var(--lime)" : "var(--surface2)",
    color: active ? "var(--lime-fg)" : "var(--ink)",
    outline: active ? "none" : "1px solid var(--line)",
  });

  // ── Step 1: format picker ──────────────────────────────────────────────
  if (step === "format") {
    return (
      <div className="tr-root">
        <style>{css}</style>
        <BackButton onClick={back} style={{ marginBottom: 14 }} />
        <div className="tr-d" style={{ fontSize: 22, marginBottom: 4 }}>{tr("trn_pick_format")}</div>
        <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 16, lineHeight: 1.5 }}>
          {tr("trn_pick_format_sub")}
        </div>
        <FormatPicker
          selected={format}
          onSelect={(f) => { setFormat(f); setStep("config"); }}
        />
      </div>
    );
  }

  // ── Step 2: config ────────────────────────────────────────────────────
  return (
    <div className="tr-root">
      <style>{css}</style>
      <BackButton onClick={() => setStep("format")} label={tr("trn_change_format")} style={{ marginBottom: 12 }} />

      <div className="tr-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Selected format badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
          background: `color-mix(in srgb, ${fmt.color} 10%, transparent)`,
          border: `1.5px solid color-mix(in srgb, ${fmt.color} 35%, transparent)`,
          borderRadius: 12,
        }}>
          <span style={{ fontSize: 22 }}>{fmt.emoji}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{fmt.name}</div>
            <div style={{ fontSize: 11, color: fmt.id === "americano" ? "var(--lime)" : fmt.color }}>{fmt.tagline}</div>
          </div>
        </div>

        <div className="tr-d" style={{ fontSize: 18 }}>{tr("trn_settings_title")}</div>

        {/* Courts / Players */}
        {!isBtb ? (
          <div>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{tr("trn_courts_label")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {COURTS_OPTS.map((o) => (
                <button key={o.v} style={chip(courts === o.v)} onClick={() => setCourts(o.v)}>
                  <div>{o.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 400, opacity: .7 }}>{o.sub}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{tr("trn_players_label")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {KOTH_PLAYER_OPTS.map((o) => (
                <button key={o.v} style={chip(playerCount === o.v)} onClick={() => setPlayerCount(o.v)}>
                  <div>{o.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, opacity: .7 }}>{o.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Points */}
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{tr("trn_points_label")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            {POINTS_OPTS.map((p) => (
              <button key={p} style={chip(points === p)} onClick={() => setPoints(p)}>{p}</button>
            ))}
          </div>
        </div>

        {/* Ввод счёта: по PIN от организатора или свободный для всех участников */}
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{tr("trn_scoring_label")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button style={chip(!openScoring)} onClick={() => setOpenScoring(false)}>
              <div>{tr("trn_scoring_pin")}</div>
              <div style={{ fontSize: 10, fontWeight: 400, opacity: .7 }}>{tr("trn_scoring_pin_sub")}</div>
            </button>
            <button style={chip(openScoring)} onClick={() => setOpenScoring(true)}>
              <div>{tr("trn_scoring_open")}</div>
              <div style={{ fontSize: 10, fontWeight: 400, opacity: .7 }}>{tr("trn_scoring_open_sub")}</div>
            </button>
          </div>
        </div>

        {/* Champion rule (King of the Court only) */}
        {isKoth && (
          <div>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{tr("trn_koth_champion_label")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { v: "court_1", label: tr("trn_koth_champion_court1"), sub: tr("trn_koth_champion_court1_sub") },
                { v: "points", label: tr("trn_koth_champion_points"), sub: tr("trn_koth_champion_points_sub") },
              ].map((o) => (
                <button key={o.v} style={chip(kotHChampionRule === o.v)} onClick={() => setKotHChampionRule(o.v)}>
                  <div>{o.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, opacity: .7 }}>{o.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date & time */}
        <DateTimePicker day={day} time={time} onDay={setDay} onTime={setTime} />

        {/* Place */}
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>{tr("game_where_label")}</div>
          <input className="tr-input" placeholder={tr("court_club_placeholder")} value={place} onChange={(e) => setPlace(e.target.value)} />
        </div>

        {/* Name */}
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>{tr("trn_name_label")}</div>
          <input className="tr-input" placeholder={fmt.name} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {/* Длительность (заменяет ручное время окончания) */}
        <DurationPicker value={durMin} onChange={setDurMin} />

        {/* Взнос с игрока (опционально). Задаётся сразу; потом можно менять и запускать
            сбор в карточке взносов внутри турнира. Пусто = без взноса. */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{tr("fee_title")}</div>
          <div style={{ fontSize: 11.5, color: "var(--mut)", marginBottom: 10 }}>{tr("fee_setup_hint")}</div>
          <div style={{ position: "relative" }}>
            <input className="tr-input" type="number" inputMode="decimal" min="0" placeholder={tr("fee_ph_each")} value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} style={{ paddingRight: 52 }} />
            <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--mut)", fontSize: 14, fontWeight: 800, pointerEvents: "none" }}>{currencySymbol(feeCur)}</span>
          </div>
          {Number(feeAmount) > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 6 }}>{tr("fee_timing_label")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button style={chip(feeTiming === "start")} onClick={() => setFeeTiming("start")}>{tr("fee_timing_start")}</button>
                <button style={chip(feeTiming === "end")} onClick={() => setFeeTiming("end")}>{tr("fee_timing_end")}</button>
              </div>
            </div>
          )}
        </div>

        {/* Описание */}
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>{tr("trn_desc_label")}</div>
          <textarea className="tr-input" rows={3} placeholder={tr("trn_desc_ph")} value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: "vertical", fontFamily: "inherit" }} />
        </div>

        {/* Уровень турнира (опционально) */}
        <LevelPicker value={level} onChange={setLevel} />

        {/* Контакт ОРГАНИЗАТОРА (кого спросить по турниру — виден участникам).
            «Выбрать из Лиги» — быстрый способ заполнить поля из друга/себя; сами
            поля Имя+контакт показываем ВСЕГДА, чтобы автор видел, что увидят игроки. */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{tr("trn_contact_org")}</div>
          <div style={{ fontSize: 11.5, color: "var(--mut)", marginBottom: 10 }}>{tr("trn_contact_org_hint")}</div>

          {/* Тумблер «Выбрать из Лиги» скрываем, если участников нет — выбирать не из кого */}
          {contactMembers.length > 0 && (
            <div onClick={() => setContactFromLeague((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10, cursor: "pointer" }}>
              <span style={{ width: 44, height: 26, borderRadius: 13, flexShrink: 0, position: "relative", transition: "background .15s",
                background: contactFromLeague ? "var(--lime)" : "var(--surface2)", border: contactFromLeague ? "none" : "1px solid var(--line)" }}>
                <span style={{ position: "absolute", top: 3, left: contactFromLeague ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{tr("contact_pick_league")}</span>
            </div>
          )}

          {/* Карусель друзей/себя — только когда включён выбор из Лиги; заполняет поля ниже */}
          {contactFromLeague && contactMembers.length > 0 && (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 10, scrollbarWidth: "none", WebkitOverflowScrolling: "touch", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 3%,#000 97%,transparent)", maskImage: "linear-gradient(90deg,transparent,#000 3%,#000 97%,transparent)" }}>
              {contactMembers.map((p) => {
                const isMe = p.id === profileId;
                const active = !!contactName && contactName === p.name;
                return (
                  <button key={p.id} type="button" className="tr-ghost" onClick={() => { setContactName(p.name); setContactLink(contactHandleOf(p.contacts)); }}
                    style={{ flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 7, padding: "6px 12px 6px 6px", borderRadius: 999, fontSize: 13, fontWeight: active || isMe ? 700 : 400,
                      borderColor: active ? "var(--lime)" : isMe ? "color-mix(in srgb, var(--lime) 45%, transparent)" : "var(--line)",
                      color: active || isMe ? "var(--lime)" : "var(--ink)" }}>
                    <Avatar name={p.name} url={p.avatar_url} id={p.id} size={22} /> {isMe ? tr("pick_me") : p.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Поля Имя + контакт — ВСЕГДА видны (превью «как увидят участники»);
              при выборе из Лиги подставляются, но остаются редактируемыми. */}
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>{tr("trn_contact_name_label")}</div>
          <input className="tr-input" placeholder={tr("trn_contact_name_ph")} value={contactName} onChange={(e) => setContactName(e.target.value)} style={{ marginBottom: 6 }} />
          <input className="tr-input" placeholder={tr("trn_contact_link_ph")} value={contactLink} onChange={(e) => setContactLink(e.target.value)} />
        </div>

        {/* Превью: что получится из настроек */}
        {(() => {
          const size = isBtb ? playerCount : courts * 4;
          const detail = format === "americano" ? tr("trn_n_rounds").replace("{n}", String(Math.max(1, size - 1)))
            : format === "beat_the_box" ? tr("trn_matches_dynamic") : tr("trn_rounds_dynamic");
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{fmt.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: "var(--mut)" }}>{tr("trn_preview_label")}: </span>
                <b>{size} {tr("trn_players_label").toLowerCase()}</b>
                <span style={{ color: "var(--mut)" }}> · {detail}</span>
              </div>
            </div>
          );
        })()}

        <button className="tr-btn" style={{ padding: 13 }} disabled={busy} onClick={go}>
          {busy ? tr("trn_creating") : tr("trn_create_go")}
        </button>
      </div>
    </div>
  );
}
