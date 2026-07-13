// Playwright — смоук-тесты в CI (НЕ на 1 ГБ сервере). Собранный dist сервируется
// `vite preview`, тесты проверяют, что экраны рендерятся без падений (белый экран /
// ReferenceError), в 3 языках и обеих темах. Данные лиги требуют бэкенда — их
// проверяем отдельно; здесь фокус на «не упало и не переполнилось».
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
