// src/lib/i18n.js — simple i18n for RU / EN / ES
export const LANGS = ['ru', 'en', 'es'];
export const LANG_LABELS = { ru: 'RU', en: 'EN', es: 'ES' };

const T = {
  ru: {
    tab_friends: 'Друзья', tab_games: 'Игры', tab_history: 'История', tab_tournaments: 'Турниры',
    league_title: 'ЛИГА ДРУЗЕЙ',
    level_beginner: 'Новичок', level_amateur: 'Любитель', level_experienced: 'Опытный',
    level_master: 'Мастер', level_legend: 'Легенда',
    matches: 'игр', tournaments: 'турниров',
    best_partner: 'Лучший партнёр',
    wins: 'победы', draws: 'ничьи', losses: 'поражения',
    rating: 'рейтинг', level: 'уровень',
    add_player: 'Добавить игрока',
    sign_in: 'Войти', sign_out: 'Выйти',
    profile_label: 'Профиль',
    back: 'Назад',
    loading: 'Загрузка…',
    install_app: 'Установить приложение',
    install_sub: 'Открывается как нативное · Работает офлайн',
    install_btn: 'Установить',
    gate_title: 'Только для участников лиги',
    gate_sub: 'Войди через кнопку наверху, чтобы видеть рейтинг друзей, историю игр и статистику.',
    together: 'вместе', versus: 'против',
    not_in_league: 'Не в лиге',
    wins_short: 'П', losses_short: 'Пор',
    games_of: 'из',
    creating: '…',
  },
  en: {
    tab_friends: 'Friends', tab_games: 'Games', tab_history: 'History', tab_tournaments: 'Cups',
    league_title: 'FRIEND LEAGUE',
    level_beginner: 'Beginner', level_amateur: 'Amateur', level_experienced: 'Experienced',
    level_master: 'Master', level_legend: 'Legend',
    matches: 'games', tournaments: 'cups',
    best_partner: 'Best partner',
    wins: 'wins', draws: 'draws', losses: 'losses',
    rating: 'rating', level: 'level',
    add_player: 'Add player',
    sign_in: 'Sign in', sign_out: 'Sign out',
    profile_label: 'Profile',
    back: 'Back',
    loading: 'Loading…',
    install_app: 'Install app',
    install_sub: 'Opens natively · Works offline',
    install_btn: 'Install',
    gate_title: 'Members only',
    gate_sub: 'Sign in to see friend rankings, match history and stats.',
    together: 'together', versus: 'versus',
    not_in_league: 'Not in league',
    wins_short: 'W', losses_short: 'L',
    games_of: 'of',
    creating: '…',
  },
  es: {
    tab_friends: 'Amigos', tab_games: 'Partidas', tab_history: 'Historial', tab_tournaments: 'Copas',
    league_title: 'LIGA DE AMIGOS',
    level_beginner: 'Principiante', level_amateur: 'Amateur', level_experienced: 'Experimentado',
    level_master: 'Maestro', level_legend: 'Leyenda',
    matches: 'partidas', tournaments: 'torneos',
    best_partner: 'Mejor compañero',
    wins: 'victorias', draws: 'empates', losses: 'derrotas',
    rating: 'puntos', level: 'nivel',
    add_player: 'Añadir jugador',
    sign_in: 'Entrar', sign_out: 'Salir',
    profile_label: 'Perfil',
    back: 'Atrás',
    loading: 'Cargando…',
    install_app: 'Instalar app',
    install_sub: 'Se abre como nativa · Funciona sin conexión',
    install_btn: 'Instalar',
    gate_title: 'Solo para miembros',
    gate_sub: 'Entra para ver el ranking, historial de partidas y estadísticas.',
    together: 'juntos', versus: 'contra',
    not_in_league: 'No en liga',
    wins_short: 'G', losses_short: 'D',
    games_of: 'de',
    creating: '…',
  },
};

export let currentLang = localStorage.getItem('plLang') || 'ru';

export function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  currentLang = lang;
  localStorage.setItem('plLang', lang);
}

export function t(key) {
  return T[currentLang]?.[key] ?? T.ru[key] ?? key;
}
