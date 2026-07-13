// Смоук: приложение и лендинг рендерятся без падений (белый экран / ReferenceError)
// во всех языках и темах. Ловит именно тот класс регрессий, что уже прилетал в прод.
import { test, expect } from '@playwright/test'

const LANGS = ['ru', 'en', 'es']
const THEMES = ['dark', 'light']

// Собираем pageerror (необработанные JS-исключения) — это и есть «белый экран».
function trackFatal(page) {
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  return errors
}

for (const lang of LANGS) {
  for (const theme of THEMES) {
    test(`приложение грузится без падений — ${lang}/${theme}`, async ({ page }) => {
      const fatal = trackFatal(page)
      await page.addInitScript(([l, t]) => {
        localStorage.setItem('plLang', l)
        localStorage.setItem('plTheme', t)
      }, [lang, theme])
      await page.goto('/')
      // дать SPA смонтироваться
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForTimeout(1200)
      // #root не должен быть пустым (белый экран)
      const rootHtml = await page.locator('#root').innerHTML()
      expect(rootHtml.length, 'SPA отрендерила контент').toBeGreaterThan(200)
      expect(fatal, `нет необработанных исключений: ${fatal.join(' | ')}`).toHaveLength(0)
    })
  }
}

for (const lang of LANGS) {
  test(`лендинг грузится без падений — ${lang}`, async ({ page }) => {
    const fatal = trackFatal(page)
    await page.goto('/landing.html')
    await page.waitForTimeout(600)
    expect(fatal, fatal.join(' | ')).toHaveLength(0)
    // на странице есть заметный контент
    await expect(page.locator('body')).toContainText(/Padel/i)
    // лендинг не должен скроллиться вбок на мобиле
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, 'лендинг без бокового скролла').toBeLessThanOrEqual(2)
  })
}

test('нет горизонтального переполнения на входном экране', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(1200)
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'страница не должна скроллиться вбок').toBeLessThanOrEqual(2)
})
