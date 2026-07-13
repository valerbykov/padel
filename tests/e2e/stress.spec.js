// Стресс-тест длинными именами/названиями через мок Supabase RPC (без бэкенда):
// гостевая публичная страница лиги /l/CODE рендерит подиум + таблицу + шапку.
// Ловит переполнение (как «Beat the Box · командммиррр…» у тестировщика).
import { test, expect } from '@playwright/test'

const LONG = 'Суперигрокссбесконечнодлиннымименембезпробелов'   // 45+ символов без пробелов
const LONG_LEAGUE = 'Лига-с-очень-длинным-названием-без-пробелов-2026'

const FIXTURE = {
  name: LONG_LEAGUE,
  member_count: 12,
  games_count: 137,
  created_at: '2026-01-15',
  logo_url: null,
  telegram_url: null,
  members: [
    { id: '1', name: LONG, rating: 1247, avatar_url: null },
    { id: '2', name: 'Мария Длиннофамильевская-Петрова', rating: 1180, avatar_url: null },
    { id: '3', name: LONG + 'Второй', rating: 1090, avatar_url: null },
    { id: '4', name: 'Алексей', rating: 1000, avatar_url: null },
    { id: '5', name: LONG + 'Пятый', rating: 970, avatar_url: null },
  ],
}

async function mockSupabase(page) {
  // get_public_league → фикстура; всё остальное на example.supabase.co → быстрый 200,
  // чтобы гостевая страница не ждала таймаутов реальной сети.
  // Порядок важен: в Playwright побеждает роут, зарегистрированный ПОСЛЕДНИМ,
  // поэтому широкий catch-all — первым, специфичный get_public_league — последним.
  await page.route('**example.supabase.co/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))
  await page.route('**/rest/v1/rpc/get_public_league*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE) }))
}

for (const theme of ['dark', 'light']) {
  test(`публичная лига: длинные имена не переполняют — ${theme}`, async ({ page }) => {
    const fatal = []
    page.on('pageerror', (e) => fatal.push(String(e)))
    await page.addInitScript((t) => { localStorage.setItem('plTheme', t); localStorage.setItem('plLang', 'ru') }, theme)
    await mockSupabase(page)
    await page.goto('/l/ABC123')
    await page.waitForTimeout(1500)
    // название лиги отрисовано
    await expect(page.locator('body')).toContainText(LONG_LEAGUE.slice(0, 20))
    // нет горизонтального переполнения
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, 'нет бокового скролла при длинных именах').toBeLessThanOrEqual(2)
    // ни один элемент не вылезает за правый край вьюпорта
    const spill = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth
      return [...document.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > vw + 1).length
    })
    expect(spill, 'нет элементов, вылезающих за правый край').toBeLessThanOrEqual(0)
    expect(fatal, fatal.join(' | ')).toHaveLength(0)
  })
}

// Гостевая страница турнира /t/CODE (4-значный код): шапка с названием, чипами
// игроков и прогрессом. Длинные имена не должны переполнять карточку.
const T_FIXTURE = {
  id: 'tid-1',
  name: 'Американо · 2 корта в очень-длинном-клубе-без-пробелов',
  status: 'open',
  target_size: 8,
  points_per_game: 32,
  format: 'americano',
  starts_at: '2026-07-16T21:00:00Z',
  place: 'Корты 5 и 6, Сколково ПадлХаб очень длинное название',
  players: [
    { id: 'p1', profile_id: 'u1', name: 'Суперигрокссбесконечнодлиннымименембезпробелов', avatar_url: null },
    { id: 'p2', profile_id: 'u2', name: 'Владислав Длиннофамильевский-Петров', avatar_url: null },
    { id: 'p3', profile_id: null, name: 'Гость', avatar_url: null },
  ],
  matches: [],
}

for (const theme of ['dark', 'light']) {
  test(`гостевой турнир: длинные имена не переполняют — ${theme}`, async ({ page }) => {
    const fatal = []
    page.on('pageerror', (e) => fatal.push(String(e)))
    await page.addInitScript((t) => { localStorage.setItem('plTheme', t); localStorage.setItem('plLang', 'ru') }, theme)
    // обогащение из таблицы (getTournament) вернёт null → падёт в фолбэк на base
    await page.route('**example.supabase.co/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))
    await page.route('**/rest/v1/rpc/get_tournament_by_code*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(T_FIXTURE) }))
    await page.goto('/t/ABCD')
    await page.waitForTimeout(1500)
    await expect(page.locator('body')).toContainText('Американо')
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, 'нет бокового скролла').toBeLessThanOrEqual(2)
    const spill = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth
      return [...document.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > vw + 1).length
    })
    expect(spill, 'нет элементов за правым краем').toBeLessThanOrEqual(0)
    expect(fatal, fatal.join(' | ')).toHaveLength(0)
  })
}
