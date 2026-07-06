// components/NotificationBell.jsx
// Колокольчик уведомлений в топбаре: новые игры и турниры в лигах пользователя.
// «Непрочитанное» синхронизируется между устройствами через
// profiles.notifications_seen_at (RPC touch_notifications_seen — см.
// migrations/2026-07-17_notifications_seen.sql). Источник событий — существующие
// таблицы games/tournaments (отдельной таблицы уведомлений нет): показываем
// созданные другими участниками за последние 2 недели; всё позже seen_at —
// непрочитанное (бейдж). Тап по уведомлению → onOpen({kind,id,groupId}) — App
// открывает игру/турнир ВНУТРИ приложения (гостевые ссылки /j//t — только фолбэк).
// Открытие панели помечает всё просмотренным (watermark-модель:
// одна отметка на всё; события старше N последних при этом тоже считаются
// прочитанными — осознанный компромисс MVP без таблицы уведомлений).
// ВАЖНО: у билдера supabase нет .catch(), а ошибки он возвращает в { error },
// НЕ бросая исключений — поэтому все результаты проверяем явно.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Trophy, Swords, Send, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { t } from "../lib/i18n";

const WINDOW_DAYS = 14;  // окно событий
const MAX_ITEMS = 20;    // сколько событий держим в панели
const THROTTLE_MS = 60000; // не перезагружаем чаще раза в минуту (visibility/открытие панели)

const ago = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return t("bell_now");
  if (m < 60) return t("bell_min").replace("{n}", String(m));
  const h = Math.floor(m / 60);
  if (h < 24) return t("bell_hr").replace("{n}", String(h));
  return t("bell_day").replace("{n}", String(Math.floor(h / 24)));
};

const fmtWhen = (iso) => {
  try { return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
};

export default function NotificationBell({ leagues = [], activeLeague = null, onOpen = null }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);      // первая загрузка завершена (для пустого состояния)
  const [seenAt, setSeenAt] = useState(undefined);  // undefined = ещё не знаем (бейдж скрыт)
  const [open, setOpen] = useState(false);
  const [shownSeenAt, setShownSeenAt] = useState(null); // снапшот на момент открытия — подсветка «новых»
  const lastLoadRef = useRef(0);

  // seen_at только растёт — защита от гонки: медленный load() со старым значением
  // не должен перетирать свежую отметку после touch_notifications_seen.
  const bumpSeenAt = useCallback((iso) => {
    setSeenAt((prev) => {
      if (prev === undefined || prev === null) return iso ?? null;
      if (!iso) return prev;
      return new Date(iso) > new Date(prev) ? iso : prev;
    });
  }, []);

  const load = useCallback(async (force = false) => {
    if (!force && Date.now() - lastLoadRef.current < THROTTLE_MS) return;
    lastLoadRef.current = Date.now();
    try {
      const ids = (leagues || []).map((l) => l.id);
      if (!ids.length) { setItems([]); setLoaded(true); return; }
      // getSession — локально, без сетевого запроса (в отличие от getUser).
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const since = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString();
      const [profQ, gQ, trQ] = await Promise.all([
        supabase.from("profiles").select("id, notifications_seen_at").eq("user_id", user.id).maybeSingle(),
        supabase.from("games")
          .select("id, invite_code, title, place, starts_at, created_at, group_id, host_id")
          .in("group_id", ids).gt("created_at", since)
          .order("created_at", { ascending: false }).limit(MAX_ITEMS),
        supabase.from("tournaments")
          .select("id, invite_code, name, format, starts_at, created_at, group_id, created_by")
          .in("group_id", ids).gt("created_at", since)
          .order("created_at", { ascending: false }).limit(MAX_ITEMS),
      ]);
      // Без профиля не знаем ни «себя», ни seen_at — оставляем прежнее состояние,
      // иначе всё стало бы «непрочитанным» и всплыли бы собственные события.
      if (profQ.error || !profQ.data) return;
      const me = profQ.data.id || null;
      bumpSeenAt(profQ.data.notifications_seen_at || null);

      // Свои создания не показываем — уведомления про действия других.
      const games = (gQ.data || []).filter((x) => x.host_id !== me).map((x) => ({
        kind: "game", id: x.id, code: x.invite_code, at: x.created_at, by: x.host_id, group_id: x.group_id,
        title: t("bell_new_game"), parts: [x.title || x.place, x.starts_at ? fmtWhen(x.starts_at) : null],
      }));
      const tours = (trQ.data || []).filter((x) => x.created_by !== me).map((x) => ({
        kind: "tour", id: x.id, code: x.invite_code, at: x.created_at, by: x.created_by, group_id: x.group_id,
        title: t("bell_new_tournament"), parts: [x.name, x.starts_at ? fmtWhen(x.starts_at) : null],
      }));

      // Имена создателей — одним запросом (профили со-участников читаемы по RLS).
      const byIds = [...new Set([...games, ...tours].map((x) => x.by).filter(Boolean))];
      const names = {};
      if (byIds.length) {
        const { data: ps } = await supabase.from("profiles").select("id, name").in("id", byIds);
        (ps || []).forEach((p) => { names[p.id] = p.name; });
      }
      const leagueName = (gid) => (leagues.length > 1 ? (leagues.find((l) => l.id === gid)?.name || null) : null);
      setItems(
        [...games, ...tours]
          .sort((a, b) => new Date(b.at) - new Date(a.at))
          .slice(0, MAX_ITEMS)
          .map((x) => ({ ...x, byName: x.by ? names[x.by] || null : null, league: leagueName(x.group_id) }))
      );
      setLoaded(true);
    } catch (e) { /* уведомления не должны ронять топбар */ }
  }, [leagues, bumpSeenAt]);

  useEffect(() => { load(true); }, [load]);
  // Обновляем при возврате на вкладку (с троттлингом) — бейдж не отстаёт.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const isNew = (x, mark) => !mark || new Date(x.at) > new Date(mark);
  const unread = seenAt === undefined ? 0 : items.filter((x) => isNew(x, seenAt)).length;

  const openPanel = () => {
    setShownSeenAt(seenAt || null);
    setOpen(true);
    load(); // троттлинг сам решит, нужна ли сеть
    // Открыл панель — всё просмотрено (сервер → синхронно на всех устройствах).
    // rpc НЕ бросает — проверяем { error }; бейдж чистим только после успеха.
    (async () => {
      try {
        const { error } = await supabase.rpc("touch_notifications_seen");
        if (!error) bumpSeenAt(new Date().toISOString());
      } catch (e) { /* оффлайн — бейдж останется */ }
    })();
  };

  const go = (x) => {
    setOpen(false);
    // Внутри приложения: полноценный экран участника с кнопкой «К списку».
    if (onOpen) { onOpen({ kind: x.kind, id: x.id, groupId: x.group_id }); return; }
    // Фолбэк без обработчика — гостевые страницы по коду.
    window.location.assign(x.kind === "tour" ? `/t/${x.code}` : `/j/${x.code}`);
  };

  if (!leagues || leagues.length === 0) return null;
  const tg = activeLeague?.telegram_url || null;

  return (
    <>
      <button onClick={openPanel} aria-label={t("bell_title")} title={t("bell_title")}
        style={{ position: "relative", width: 34, height: 34, flexShrink: 0, borderRadius: 999, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--mut)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <Bell size={17} />
        {unread > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 999, background: "var(--coral)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--bg)", boxSizing: "border-box", fontFamily: "'Outfit',sans-serif" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && createPortal(
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.45)", backdropFilter: "blur(3px)", fontFamily: "'Outfit',sans-serif" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 54px)", right: 8, left: 8, maxWidth: 400, marginLeft: "auto", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,.45)", maxHeight: "72vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "10px 12px 8px 14px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>{t("bell_title")}</span>
              <button onClick={() => setOpen(false)} aria-label="✕"
                style={{ marginLeft: "auto", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--mut)", cursor: "pointer", padding: 8, display: "flex" }}><X size={16} /></button>
            </div>
            <div style={{ overflowY: "auto" }}>
              {!loaded && items.length === 0 && (
                <div style={{ padding: "26px 14px", textAlign: "center", color: "var(--mut)", fontSize: 13 }}>{t("loading")}</div>
              )}
              {loaded && items.length === 0 && (
                <div style={{ padding: "26px 14px", textAlign: "center", color: "var(--mut)", fontSize: 13 }}>{t("bell_empty")}</div>
              )}
              {items.map((x) => {
                const fresh = isNew(x, shownSeenAt);
                const sub = [x.league, ...x.parts, x.byName ? `${t("created_by_label").toLowerCase()} ${x.byName}` : null].filter(Boolean).join(" · ");
                return (
                  <div key={x.kind + x.id} onClick={() => go(x)}
                    style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "11px 14px", borderBottom: "1px solid var(--line)", cursor: "pointer", background: fresh ? "color-mix(in srgb, var(--lime) 7%, transparent)" : "none" }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: x.kind === "tour" ? "color-mix(in srgb, var(--lime) 15%, transparent)" : "color-mix(in srgb, var(--yellow) 16%, transparent)", color: x.kind === "tour" ? "var(--lime)" : "var(--yellow)" }}>
                      {x.kind === "tour" ? <Trophy size={17} /> : <Swords size={17} />}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: fresh ? "var(--ink)" : "var(--mut)" }}>{x.title}</div>
                      {sub && <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 1, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10.5, color: "var(--mut)" }}>{ago(x.at)}</span>
                      {fresh && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--lime)" }} />}
                    </div>
                  </div>
                );
              })}
              {tg && (
                <a href={tg} target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 14px", color: "var(--lime)", fontSize: 12.5, fontWeight: 600, textDecoration: "none", background: "color-mix(in srgb, var(--lime) 8%, transparent)" }}>
                  <Send size={14} /> {t("bell_open_tg")}
                </a>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
