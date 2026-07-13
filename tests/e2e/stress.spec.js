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
