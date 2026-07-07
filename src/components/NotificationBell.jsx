// components/NotificationBell.jsx
// Колокольчик уведомлений в топбаре. События по всем лигам пользователя:
//   • новая игра / турнир (создали другие);
//   • объявление лиги (league_posts, пишет владелец/организатор);
//   • «тебя поставили в состав» (game_slots.taken_by / tournament_players.added_by);
//   • «игра прошла — введи счёт» (starts_at позади, счёта нет; для участников и хоста).
// «Непрочитанное» синхронизируется между устройствами через
// profiles.notifications_seen_at (RPC touch_notifications_seen). Тап по плитке →
// onOpen({kind,id,groupId}) — App открывает объект ВНУТРИ приложения.
// Мгновенность: Realtime-подписка на insert games/tournaments/league_posts
// (+ фолбэк-обновление при возврате на вкладку). Число непрочитанного дублируется
// на ИКОНКЕ приложения (lib/badge.js: PWA Badging API + Capacitor Badge).
// Watermark-модель: открытие панели помечает всё просмотренным.
// ВАЖНО: у билдера supabase нет .catch(), ошибки приходят в { error } без
// исключений — все результаты проверяем явно.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Trophy, Swords, Send, X, Megaphone, AlertTriangle, UserPlus, LineChart, Link2, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import { setAppBadgeCount } from "../lib/badge";
import { t } from "../lib/i18n";
import { postLeagueAnnouncement, listLeaguePosts, deleteLeaguePost } from "../lib/padelApi";

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

// Вид плитки по типу события: иконка + акцентный цвет (все цвета — тем. переменные).
const KIND_META = {
  tour:  { Icon: Trophy,        color: "var(--lime)" },
  game:  { Icon: Swords,        color: "var(--yellow)" },
  post:  { Icon: Megaphone,     color: "var(--coral)" },
  score: { Icon: AlertTriangle, color: "var(--coral)" },
  slot:  { Icon: UserPlus,      color: "var(--yellow)" },
  tslot: { Icon: UserPlus,      color: "var(--lime)" },
  rating:{ Icon: LineChart,     color: "var(--lime)" },
  gjoin: { Icon: Link2,         color: "var(--yellow)" },
  tjoin: { Icon: Link2,         color: "var(--lime)" },
};

export default function NotificationBell({ leagues = [], activeLeague = null, onOpen = null }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);      // первая загрузка завершена (для пустого состояния)
  const [seenAt, setSeenAt] = useState(undefined);  // undefined = ещё не знаем (бейдж скрыт)
  const [open, setOpen] = useState(false);
  const [shownSeenAt, setShownSeenAt] = useState(null); // снапшот на момент открытия — подсветка «новых»
  const lastLoadRef = useRef(0);
  // Композер объявлений лиги (только для владельца/организатора активной лиги).
  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [showAllPosts, setShowAllPosts] = useState(false);

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

      const now = Date.now();
      const since = new Date(now - WINDOW_DAYS * 864e5).toISOString();
      // Волна 1: профиль + события лиг. slots/matches у игр — для «введи счёт».
      const [profQ, gQ, trQ, pQ] = await Promise.all([
        supabase.from("profiles").select("id, notifications_seen_at").eq("user_id", user.id).maybeSingle(),
        // Микс-раунды («Сыграть ещё») исключаем — внутренние пере-жеребьёвки, не новость.
        supabase.from("games")
          .select("id, invite_code, title, place, starts_at, status, created_at, group_id, host_id, slots:game_slots(profile_id), matches(id)")
          .in("group_id", ids).is("mix_group_id", null).gt("created_at", since)
          .order("created_at", { ascending: false }).limit(MAX_ITEMS),
        supabase.from("tournaments")
          .select("id, invite_code, name, format, starts_at, created_at, group_id, created_by")
          .in("group_id", ids).gt("created_at", since)
          .order("created_at", { ascending: false }).limit(MAX_ITEMS),
        supabase.from("league_posts")
          .select("id, group_id, text, created_at, author_id")
          .in("group_id", ids).gt("created_at", since)
          .order("created_at", { ascending: false }).limit(MAX_ITEMS),
      ]);
      // Без профиля не знаем ни «себя», ни seen_at — оставляем прежнее состояние,
      // иначе всё стало бы «непрочитанным» и всплыли бы собственные события.
      if (profQ.error || !profQ.data) return;
      // Транзиентная ошибка базовых запросов → НЕ коммитим частичный список
      // (иначе бейдж «мигнёт» нулём и категории пропадут до следующей загрузки).
      // posts (pQ) терпим как пустые: таблицы может не быть до миграции 2026-07-18.
      if (gQ.error || trQ.error) return;
      const me = profQ.data.id || null;
      bumpSeenAt(profQ.data.notifications_seen_at || null);

      // Волна 2 (нужен me): «тебя поставили в состав» — слоты игр и составы турниров.
      const [slQ, tpQ, rcQ, gjQ, tjQ] = me ? await Promise.all([
        supabase.from("game_slots")
          .select("id, taken_at, taken_by, game:games(id, invite_code, title, place, starts_at, group_id)")
          .eq("profile_id", me).gt("taken_at", since)
          .order("taken_at", { ascending: false }).limit(MAX_ITEMS),
        supabase.from("tournament_players")
          .select("id, created_at, added_by, tournament:tournaments(id, invite_code, name, starts_at, group_id)")
          .eq("profile_id", me).gt("created_at", since)
          .order("created_at", { ascending: false }).limit(MAX_ITEMS),
        // «результат внесён / рейтинг изменился» — мои строки rating_changes.
        supabase.from("rating_changes")
          .select("id, delta, created_at, group_id, match:matches(game_id)")
          .eq("profile_id", me).in("group_id", ids).gt("created_at", since)
          .order("created_at", { ascending: false }).limit(MAX_ITEMS),
        // «кто-то вступил по твоей ссылке» в игру, где я хост (self-join: taken_by = profile_id).
        supabase.from("game_slots")
          .select("id, taken_at, taken_by, profile_id, game:games!inner(id, invite_code, title, place, starts_at, group_id, host_id)")
          .eq("game.host_id", me).gt("taken_at", since)
          .order("taken_at", { ascending: false }).limit(MAX_ITEMS),
        // ...в турнир, который создал я (self-join: added_by = profile_id).
        supabase.from("tournament_players")
          .select("id, created_at, added_by, profile_id, tournament:tournaments!inner(id, invite_code, name, starts_at, group_id, created_by)")
          .eq("tournament.created_by", me).gt("created_at", since)
          .order("created_at", { ascending: false }).limit(MAX_ITEMS),
      ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

      const allGames = gQ.data || [];
      // «Игра прошла — введи счёт»: время позади, счёта нет, я хост или в составе.
      // Включаем и СВОИ игры — это напоминание о действии, а не новость.
      const scoreItems = allGames
        .filter((g) => g.status === "open" && g.starts_at && new Date(g.starts_at).getTime() < now
          && (g.matches || []).length === 0
          && (g.host_id === me || (g.slots || []).some((s) => s.profile_id === me)))
        .map((g) => ({
          kind: "score", key: "score" + g.id, navKind: "game", navId: g.id, code: g.invite_code,
          at: g.starts_at, by: null, group_id: g.group_id,
          title: t("bell_need_score"), parts: [g.title || g.place, fmtWhen(g.starts_at)],
        }));
      const scoreIds = new Set(scoreItems.map((x) => x.navId));

      // Новые игры/турниры/объявления — только чужие; игры-«введи счёт» не дублируем.
      const games = allGames
        .filter((x) => x.host_id !== me && !scoreIds.has(x.id))
        .map((x) => ({
          kind: "game", key: "game" + x.id, navKind: "game", navId: x.id, code: x.invite_code,
          at: x.created_at, by: x.host_id, group_id: x.group_id,
          title: t("bell_new_game"), parts: [x.title || x.place, x.starts_at ? fmtWhen(x.starts_at) : null],
        }));
      const tours = (trQ.data || [])
        .filter((x) => x.created_by !== me)
        .map((x) => ({
          kind: "tour", key: "tour" + x.id, navKind: "tour", navId: x.id, code: x.invite_code,
          at: x.created_at, by: x.created_by, group_id: x.group_id,
          title: t("bell_new_tournament"), parts: [x.name, x.starts_at ? fmtWhen(x.starts_at) : null],
        }));
      const posts = (pQ.data || [])
        .filter((x) => x.author_id !== me)
        .map((x) => ({
          kind: "post", key: "post" + x.id, navKind: "post", navId: x.id, code: null,
          at: x.created_at, by: x.author_id, group_id: x.group_id,
          title: t("bell_post"), parts: [x.text.length > 90 ? x.text.slice(0, 90) + "…" : x.text],
        }));
      // «Тебя поставили»: только когда это сделал другой (taken_by/added_by ≠ я).
      const slots = (slQ.data || [])
        .filter((x) => x.taken_by && x.taken_by !== me && x.game && ids.includes(x.game.group_id))
        .map((x) => ({
          kind: "slot", key: "slot" + x.id, navKind: "game", navId: x.game.id, code: x.game.invite_code,
          at: x.taken_at, by: x.taken_by, group_id: x.game.group_id,
          title: t("bell_added_game"), parts: [x.game.title || x.game.place, x.game.starts_at ? fmtWhen(x.game.starts_at) : null],
        }));
      const tslots = (tpQ.data || [])
        .filter((x) => x.added_by && x.added_by !== me && x.tournament && ids.includes(x.tournament.group_id))
        .map((x) => ({
          kind: "tslot", key: "tslot" + x.id, navKind: "tour", navId: x.tournament.id, code: x.tournament.invite_code,
          at: x.created_at, by: x.added_by, group_id: x.tournament.group_id,
          title: t("bell_added_tour"), parts: [x.tournament.name, x.tournament.starts_at ? fmtWhen(x.tournament.starts_at) : null],
        }));

      // «результат внесён / рейтинг» — для игровых матчей (навигация в игру).
      const ratings = (rcQ.data || [])
        .filter((x) => x.match && x.match.game_id)
        .map((x) => ({
          kind: "rating", key: "rating" + x.id, navKind: "game", navId: x.match.game_id, code: null,
          at: x.created_at, by: null, group_id: x.group_id,
          title: t("bell_result"), parts: [`${x.delta > 0 ? "+" : ""}${x.delta} ${t("bell_rating_unit")}`],
        }));
      // Вступления по ссылке: только self-join (кто вступил = кого вписали) и не я.
      const gjoins = (gjQ.data || [])
        .filter((x) => x.game && x.taken_by && x.taken_by === x.profile_id && x.taken_by !== me && ids.includes(x.game.group_id))
        .map((x) => ({
          kind: "gjoin", key: "gjoin" + x.id, navKind: "game", navId: x.game.id, code: x.game.invite_code,
          at: x.taken_at, by: x.profile_id, group_id: x.game.group_id,
          title: t("bell_joined"), parts: [x.game.title || x.game.place, x.game.starts_at ? fmtWhen(x.game.starts_at) : null],
        }));
      const tjoins = (tjQ.data || [])
        .filter((x) => x.tournament && x.added_by && x.added_by === x.profile_id && x.added_by !== me && ids.includes(x.tournament.group_id))
        .map((x) => ({
          kind: "tjoin", key: "tjoin" + x.id, navKind: "tour", navId: x.tournament.id, code: x.tournament.invite_code,
          at: x.created_at, by: x.profile_id, group_id: x.tournament.group_id,
          title: t("bell_joined"), parts: [x.tournament.name, x.tournament.starts_at ? fmtWhen(x.tournament.starts_at) : null],
        }));

      const merged = [...scoreItems, ...games, ...tours, ...posts, ...slots, ...tslots, ...ratings, ...gjoins, ...tjoins];

      // Имена авторов — одним запросом (профили со-участников читаемы по RLS).
      const byIds = [...new Set(merged.map((x) => x.by).filter(Boolean))];
      const names = {};
      if (byIds.length) {
        const { data: ps } = await supabase.from("profiles").select("id, name").in("id", byIds);
        (ps || []).forEach((p) => { names[p.id] = p.name; });
      }
      const leagueName = (gid) => (leagues.length > 1 ? (leagues.find((l) => l.id === gid)?.name || null) : null);
      setItems(
        merged
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

  // Realtime: мгновенный бейдж при новых событиях в лигах (пока приложение открыто).
  // Таблицы добавлены в публикацию миграцией 2026-07-18; RLS Realtime уважает.
  useEffect(() => {
    const ids = (leagues || []).map((l) => l.id);
    if (!ids.length) return;
    const filter = `group_id=in.(${ids.join(",")})`;
    const ch = supabase.channel("bell-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "games", filter }, () => load(true))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tournaments", filter }, () => load(true))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "league_posts", filter }, () => load(true))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [leagues, load]);

  const isNew = (x, mark) => !mark || new Date(x.at) > new Date(mark);
  const unread = seenAt === undefined ? 0 : items.filter((x) => isNew(x, seenAt)).length;

  // Число непрочитанного — на иконку приложения (PWA/Android/iOS).
  useEffect(() => {
    if (seenAt === undefined || !loaded) return;
    setAppBadgeCount(unread);
  }, [unread, seenAt, loaded]);

  const canPost = !!activeLeague && (activeLeague.role === "owner" || activeLeague.role === "admin");

  // Объявления активной лиги — для композера (грузим тем, кто может публиковать).
  useEffect(() => {
    if (!canPost || !activeLeague?.id) { setPosts([]); return; }
    let alive = true;
    listLeaguePosts(activeLeague.id, 10).then((ps) => { if (alive) setPosts(ps); }).catch(() => {});
    return () => { alive = false; };
  }, [activeLeague, canPost]);

  const publishPost = async () => {
    const clean = postText.trim();
    if (!clean || posting || !activeLeague?.id) return;
    setPosting(true);
    try {
      const np = await postLeagueAnnouncement(activeLeague.id, clean);
      setPosts((prev) => [{ ...np, author_name: null }, ...prev].slice(0, 10));
      setPostText("");
    } catch (e) { /* ignore */ }
    finally { setPosting(false); }
  };
  const removePost = async (id) => {
    try { await deleteLeaguePost(id); setPosts((ps) => ps.filter((p) => p.id !== id)); } catch (e) { /* ignore */ }
  };

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
    if (onOpen) { onOpen({ kind: x.navKind, id: x.navId, groupId: x.group_id }); return; }
    // Фолбэк без обработчика — гостевые страницы по коду.
    if (x.code) window.location.assign(x.navKind === "tour" ? `/t/${x.code}` : `/j/${x.code}`);
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
              {canPost && (
                <div style={{ padding: "10px 12px 10px", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                    <Megaphone size={14} style={{ color: "var(--lime)" }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{t("bell_post_composer")}</span>
                    <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--mut)", fontWeight: 600, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <Users size={12} /> {activeLeague?.name}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={postText} onChange={(e) => setPostText(e.target.value)} maxLength={500}
                      placeholder={t("league_post_placeholder")} onKeyDown={(e) => e.key === "Enter" && publishPost()}
                      style={{ flex: 1, minWidth: 0, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 11, color: "var(--ink)", fontSize: 13.5, padding: "9px 11px", outline: "none", fontFamily: "'Outfit',sans-serif" }} />
                    <button onClick={publishPost} disabled={posting || !postText.trim()}
                      style={{ flexShrink: 0, padding: "0 14px", borderRadius: 11, border: "none", cursor: posting || !postText.trim() ? "default" : "pointer", background: "var(--lime)", color: "var(--lime-fg)", fontWeight: 700, fontSize: 13, fontFamily: "'Outfit',sans-serif", opacity: posting || !postText.trim() ? 0.55 : 1 }}>
                      {posting ? "…" : t("league_post_send")}
                    </button>
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 6 }}>{t("bell_post_hint")}</div>
                  {posts.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--mut)", fontWeight: 600 }}>{t("bell_posts_sent")}</span>
                        <span style={{ fontSize: 11, color: "var(--mut)" }}>· {posts.length}</span>
                        {posts.length > 2 && (
                          <button onClick={() => setShowAllPosts((v) => !v)}
                            style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--lime)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "'Outfit',sans-serif" }}>
                            {showAllPosts ? t("league_posts_collapse") : t("league_posts_showall").replace("{n}", String(posts.length))}
                          </button>
                        )}
                      </div>
                      {(showAllPosts ? posts : posts.slice(0, 2)).map((p) => (
                        <div key={p.id} style={{ position: "relative", padding: "8px 12px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 11, marginBottom: 6 }}>
                          <div style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word", paddingRight: 20 }}>{p.text}</div>
                          <div style={{ fontSize: 10, color: "var(--mut)", marginTop: 3 }}>
                            {p.author_name ? p.author_name + " · " : ""}{(() => { try { return new Date(p.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } })()}
                          </div>
                          <button onClick={() => removePost(p.id)} aria-label={t("delete_btn")} title={t("delete_btn")}
                            style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", color: "var(--mut)", cursor: "pointer", padding: 2, display: "flex" }}>
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!loaded && items.length === 0 && (
                <div style={{ padding: "26px 14px", textAlign: "center", color: "var(--mut)", fontSize: 13 }}>{t("loading")}</div>
              )}
              {loaded && items.length === 0 && (
                <div style={{ padding: "26px 14px", textAlign: "center", color: "var(--mut)", fontSize: 13 }}>{t("bell_empty")}</div>
              )}
              {items.map((x) => {
                const fresh = isNew(x, shownSeenAt);
                const meta = KIND_META[x.kind] || KIND_META.game;
                const byVerb = (x.kind === "slot" || x.kind === "tslot") ? "bell_added_by"
                  : (x.kind === "gjoin" || x.kind === "tjoin") ? "bell_joined_by"
                  : "created_by_label";
                const byLabel = x.byName ? `${t(byVerb).toLowerCase()} ${x.byName}` : null;
                const sub = [x.league, ...x.parts, byLabel].filter(Boolean).join(" · ");
                const clickable = !!onOpen || !!x.code;
                return (
                  <div key={x.key} onClick={clickable ? () => go(x) : undefined}
                    style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "11px 14px", borderBottom: "1px solid var(--line)", cursor: clickable ? "pointer" : "default", background: fresh ? "color-mix(in srgb, var(--lime) 7%, transparent)" : "none" }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, color: meta.color }}>
                      <meta.Icon size={17} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: fresh ? "var(--ink)" : "var(--mut)" }}>{x.title}</div>
                      {sub && <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 1, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{sub}</div>}
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
