# Турнир: поля приглашения (B1 — E1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать организатору задавать при создании турнира **описание**, **время окончания** и **контакт («ответственный»)**, и показывать их в приложении и на публичной странице приглашения `/t/CODE`.

**Architecture:** Чисто клиентская работа. Колонки (`description`, `ends_at`, `contact_name`, `contact_link`) и приём их в `createTournament(...)` уже сделаны Частью A. `get_tournament_by_code` через `to_jsonb(t)` уже отдаёт все колонки турнира, поэтому миграции НЕ нужно. Добавляем поля в форму создания (`Create` в `Tournaments.jsx`) и вывод в двух местах: шапка турнира в приложении (`Tournaments.jsx`) и карточка `/t/CODE` (`TournamentJoin.jsx`). Плюс i18n-ключи.

**Tech Stack:** Vite + React 18 (plain JS, no TS); i18n `src/lib/i18n.js` (ru/en/es).

## Global Constraints

- Node с тесным heap: префикс `NODE_OPTIONS=--max-old-space-size=512`. Билд может OOM — не поднимать лимит молча, всплыть.
- Plain JavaScript/JSX, TypeScript НЕТ.
- **Никакого хардкод-русского (или любого литерального текста) в JSX** — все видимые строки через `tr("ключ")` (ESLint-гейт от «белого экрана»).
- Тест-фреймворка НЕТ: гейт каждого таска — `NODE_OPTIONS=--max-old-space-size=512 npm run build` завершается `✓ built`. Визуальную проверку делает пользователь.
- Комментарии по-русски. Бренды конкурентов в копии не используем.
- НЕ деплоить (батч). Коммитить каждый таск, только относящиеся к таску файлы (в рабочем дереве есть посторонние незакоммиченные правки — не трогать).
- `ends_at` — то же число (день старта) + время окончания; храним ISO. Если окончание ≤ начала — не сохраняем (поле-подсказка, не жёсткая валидация).

---

### Task 1: i18n-ключи полей приглашения (ru/en/es)

**Files:**
- Modify: `src/lib/i18n.js` (ru-блок после `trn_name_label` строка ~368; en после ~781; es после ~1194)

**Interfaces:**
- Produces: ключи `trn_desc_label`, `trn_desc_ph`, `trn_end_label`, `trn_contact_name_label`, `trn_contact_name_ph`, `trn_contact_link_ph` во всех трёх локалях.

- [ ] **Step 1: Добавить ключи в RU**

В `src/lib/i18n.js` найти строку (ru, ~368):
```js
    trn_date_label: 'Дата и время', trn_name_label: 'Название',
```
Добавить СРАЗУ ПОСЛЕ неё новую строку:
```js
    trn_desc_label: 'Описание', trn_desc_ph: 'Пара слов о турнире…', trn_end_label: 'Время окончания', trn_contact_name_label: 'Ответственный', trn_contact_name_ph: 'Имя', trn_contact_link_ph: 'Телеграм / телефон / ссылка',
```

- [ ] **Step 2: Добавить ключи в EN**

Найти (en, ~781):
```js
    trn_date_label: 'Date & time', trn_name_label: 'Name',
```
Добавить сразу после:
```js
    trn_desc_label: 'Description', trn_desc_ph: 'A few words about the tournament…', trn_end_label: 'End time', trn_contact_name_label: 'Contact', trn_contact_name_ph: 'Name', trn_contact_link_ph: 'Telegram / phone / link',
```

- [ ] **Step 3: Добавить ключи в ES**

Найти (es, ~1194):
```js
    trn_date_label: 'Fecha y hora', trn_name_label: 'Nombre',
```
Добавить сразу после:
```js
    trn_desc_label: 'Descripción', trn_desc_ph: 'Unas palabras sobre el torneo…', trn_end_label: 'Hora de fin', trn_contact_name_label: 'Responsable', trn_contact_name_ph: 'Nombre', trn_contact_link_ph: 'Telegram / teléfono / enlace',
```

- [ ] **Step 4: Проверить наличие ключей во всех локалях**

Run: `grep -c "trn_desc_label\|trn_end_label\|trn_contact_link_ph" src/lib/i18n.js`
Expected: `9` (по 3 ключа × 3 локали).
Затем: `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.js
git commit -m "i18n: ключи полей приглашения (описание/окончание/контакт) ru/en/es"
```

---

### Task 2: Поля в форме создания турнира

**Files:**
- Modify: `src/components/Tournaments.jsx` (`Create`: стейт ~548; форма ~733; вызов `createTournament` в `go()` ~594-596)

**Interfaces:**
- Consumes: i18n-ключи (Task 1); `createTournament(groupId, {..., endsAt, description, contactName, contactLink})` (готово в Части A).
- Produces: форма создания собирает и передаёт 4 новых поля.

- [ ] **Step 1: Добавить стейт**

В `src/components/Tournaments.jsx`, в `Create`, найти:
```jsx
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
```
Заменить на:
```jsx
  const [name, setName] = useState("");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactLink, setContactLink] = useState("");
  const [busy, setBusy] = useState(false);
```

- [ ] **Step 2: Добавить инпуты в форму (после «Названия»)**

Найти блок «Name» в форме:
```jsx
        {/* Name */}
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>{tr("trn_name_label")}</div>
          <input className="tr-input" placeholder={fmt.name} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
```
Заменить на (добавляет время окончания, описание, контакт ПОСЛЕ названия):
```jsx
        {/* Name */}
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>{tr("trn_name_label")}</div>
          <input className="tr-input" placeholder={fmt.name} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {/* Время окончания (опционально, тот же день) */}
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>{tr("trn_end_label")}</div>
          <input className="tr-input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>

        {/* Описание */}
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>{tr("trn_desc_label")}</div>
          <textarea className="tr-input" rows={3} placeholder={tr("trn_desc_ph")} value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: "vertical", fontFamily: "inherit" }} />
        </div>

        {/* Ответственный / контакт */}
        <div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>{tr("trn_contact_name_label")}</div>
          <input className="tr-input" placeholder={tr("trn_contact_name_ph")} value={contactName} onChange={(e) => setContactName(e.target.value)} style={{ marginBottom: 6 }} />
          <input className="tr-input" placeholder={tr("trn_contact_link_ph")} value={contactLink} onChange={(e) => setContactLink(e.target.value)} />
        </div>
```

- [ ] **Step 3: Передать поля в `createTournament`**

В `go()` найти:
```jsx
      let startsAtIso = null;
      try { if (date) startsAtIso = new Date(date).toISOString(); } catch (e) { startsAtIso = null; }
      const trn = await createTournament(groupId, { name: name.trim() || null, pointsPerGame: points, targetSize, format, createdBy: profileId, startsAt: startsAtIso, place, kotHChampionRule: isKoth ? kotHChampionRule : undefined, openScoring });
```
Заменить на:
```jsx
      let startsAtIso = null;
      try { if (date) startsAtIso = new Date(date).toISOString(); } catch (e) { startsAtIso = null; }
      // Окончание: тот же день + endTime. Раньше начала — игнорируем (это подсказка).
      let endsAtIso = null;
      try { if (day && endTime) endsAtIso = new Date(`${day}T${endTime}`).toISOString(); } catch (e) { endsAtIso = null; }
      if (endsAtIso && startsAtIso && endsAtIso <= startsAtIso) endsAtIso = null;
      const trn = await createTournament(groupId, { name: name.trim() || null, pointsPerGame: points, targetSize, format, createdBy: profileId, startsAt: startsAtIso, endsAt: endsAtIso, place, description: description.trim() || null, contactName: contactName.trim() || null, contactLink: contactLink.trim() || null, kotHChampionRule: isKoth ? kotHChampionRule : undefined, openScoring });
```

- [ ] **Step 4: Проверить сборку**

Run: `NODE_OPTIONS=--max-old-space-size=512 npm run build`
Expected: `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add src/components/Tournaments.jsx
git commit -m "турниры: поля описания/окончания/контакта в форме создания"
```

---

### Task 3: Показ полей в шапке турнира (в приложении)

**Files:**
- Modify: `src/components/Tournaments.jsx` (блок мета в шапке, строки ~1145-1150)

**Interfaces:**
- Consumes: `trnData.ends_at`, `trnData.description`, `trnData.contact_name`, `trnData.contact_link` (в `T_SELECT`, готово в Части A); ключ `trn_contact_name_label` (Task 1).

- [ ] **Step 1: Расширить мета-блок шапки**

Найти:
```jsx
        {(trnData.starts_at || trnData.place) && (
          <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {trnData.starts_at && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} />{(() => { try { return new Date(trnData.starts_at).toLocaleString(dateLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } })()}</span>}
            {trnData.place && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} />{trnData.place}</span>}
          </div>
        )}
```
Заменить на (в дату добавляем «– время окончания»; ниже — описание и контакт):
```jsx
        {(trnData.starts_at || trnData.place) && (
          <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {trnData.starts_at && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} />{(() => { try { const s = new Date(trnData.starts_at).toLocaleString(dateLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); const e = trnData.ends_at ? new Date(trnData.ends_at).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" }) : null; return e ? `${s} – ${e}` : s; } catch (e) { return ""; } })()}</span>}
            {trnData.place && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} />{trnData.place}</span>}
          </div>
        )}
        {trnData.description && (
          <div style={{ fontSize: 12.5, color: "var(--ink)", marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{trnData.description}</div>
        )}
        {trnData.contact_name && (
          <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 6 }}>
            {tr("trn_contact_name_label")}: <span style={{ color: "var(--ink)", fontWeight: 600 }}>{trnData.contact_name}</span>{trnData.contact_link && <span> · {trnData.contact_link}</span>}
          </div>
        )}
```

- [ ] **Step 2: Проверить сборку**

Run: `NODE_OPTIONS=--max-old-space-size=512 npm run build`
Expected: `✓ built`.

- [ ] **Step 3: Commit**

```bash
git add src/components/Tournaments.jsx
git commit -m "турниры: показ окончания/описания/контакта в шапке турнира"
```

---

### Task 4: Показ полей на публичной странице `/t/CODE`

**Files:**
- Modify: `src/components/TournamentJoin.jsx` (`TrnMeta` строки ~23-28; карточка приглашения — после строки очков ~176)

**Interfaces:**
- Consumes: `t.ends_at`, `t.description`, `t.contact_name`, `t.contact_link` (уже в `to_jsonb(t)` из `get_tournament_by_code`); ключ `trn_contact_name_label`. `dateLocale` уже импортирован в файле (строка 11).

- [ ] **Step 1: Добавить окончание в `TrnMeta`**

Найти (строки ~23-28):
```jsx
const TrnMeta = ({ trn }) => ((trn.starts_at || trn.place) ? (
  <div style={{ fontSize: 13, color: "var(--mut)", display: "flex", gap: 12, margin: "6px 0 12px", flexWrap: "wrap" }}>
    {trn.starts_at && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={13} />{fmtDate(trn.starts_at)}</span>}
    {trn.place && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} />{trn.place}</span>}
  </div>
) : null);
```
Заменить на:
```jsx
const TrnMeta = ({ trn }) => ((trn.starts_at || trn.place) ? (
  <div style={{ fontSize: 13, color: "var(--mut)", display: "flex", gap: 12, margin: "6px 0 12px", flexWrap: "wrap" }}>
    {trn.starts_at && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={13} />{fmtDate(trn.starts_at)}{trn.ends_at ? ` – ${(() => { try { return new Date(trn.ends_at).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } })()}` : ""}</span>}
    {trn.place && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} />{trn.place}</span>}
  </div>
) : null);
```

- [ ] **Step 2: Добавить описание и контакт на карточку приглашения**

Найти строку очков в блоке `t.status === "open"` (около строки 176):
```jsx
                <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 10 }}>{tr("pub_upto")} {t.points_per_game} {tr("pub_points")}</div>
```
Заменить на (описание и контакт сразу после строки очков):
```jsx
                <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 10 }}>{tr("pub_upto")} {t.points_per_game} {tr("pub_points")}</div>
                {t.description && <div style={{ fontSize: 13, color: "var(--ink)", margin: "0 0 10px", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{t.description}</div>}
                {t.contact_name && <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 10 }}>{tr("trn_contact_name_label")}: <span style={{ color: "var(--ink)", fontWeight: 600 }}>{t.contact_name}</span>{t.contact_link && <span> · {t.contact_link}</span>}</div>}
```

Примечание: если строка очков в файле выглядит иначе — найти её по `tr("pub_upto")` и вставить два новых `{t.description && …}` / `{t.contact_name && …}` блока сразу после неё, внутри того же контейнера.

- [ ] **Step 3: Проверить сборку**

Run: `NODE_OPTIONS=--max-old-space-size=512 npm run build`
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add src/components/TournamentJoin.jsx
git commit -m "приглашение /t/CODE: показ окончания/описания/контакта"
```

---

## Deferred (не в B1)

- **B2 (D + E2)**: афишный редизайн `/t/CODE`, запись ПАРАМИ (ростер по парам, открытые пары, `?pair=N`), экран формирования пар на старте, подключение `pairStandings` + подсветка чемпион-пары. Тогда же в `get_tournament_by_code` добавить `pair_no` в агрегат `players` (сейчас его там нет).
- E3 (уровни), E4 (взносы+валюта), E (Round Robin) — свои спеки.

## Self-review

- **Покрытие:** описание/окончание/контакт в форме создания (Task 2) ✓; показ в приложении (Task 3) ✓; показ на `/t/CODE` (Task 4) ✓; i18n (Task 1) ✓. Миграция не нужна (`to_jsonb(t)` + `T_SELECT` уже отдают поля).
- **Плейсхолдеров нет:** весь JSX/JS/ключи приведены целиком.
- **Согласованность:** ключ `trn_contact_name_label` (Task 1) используется в Task 2 (форма), Task 3 (шапка), Task 4 (`/t/CODE`); поля `endsAt/description/contactName/contactLink` совпадают с сигнатурой `createTournament` из Части A; читаемые поля `ends_at/description/contact_name/contact_link` совпадают с `T_SELECT` (Часть A) и `to_jsonb(t)`.
- **ESLint-гейт:** все видимые строки через `tr()`, литерального русского в JSX нет.
