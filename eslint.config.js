import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// Цвета структуры темы — их НЕЛЬЗЯ хардкодить в компонентах (в светлой теме
// элемент останется тёмным). Только через var(--bg/surface/surface2/line/ink/mut).
const THEME_HEX = '11211b|16291f|22382c|eef3ee|7d9488'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Идиома кодовой базы: `catch (e) {}` — молча глотаем необязательные
      // ошибки (кэш, clipboard и т.п.). Не считаем это проблемой.
      // no-unused-vars и react-hooks/* — advisory (неиспользуемые импорты,
      // подсказки хуков): держим как warn, чтобы CI не краснел на них, но были
      // видны. Красным CI делают только правила-ошибки ниже (реальные баги).
      'no-unused-vars': ['warn', { caughtErrors: 'none', varsIgnorePattern: '^_|^React$' }],
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
      // TDZ-гейт: переменная (const/let) использована ДО объявления — ровно тот
      // баг, что уронил прод в белый экран (openTourPlayer читал players раньше
      // useState). Функции не трогаем (они хойстятся).
      'no-use-before-define': ['error', { functions: false, variables: true, classes: false }],
      // Хелперы рядом с компонентами — осознанный паттерн; правило только про HMR.
      'react-refresh/only-export-components': 'off',
      // Гейты качества (ловят классы багов от тестировщиков):
      'no-restricted-syntax': [
        'error',
        {
          // 1) Хардкод цвета темы → должен быть var(--...). Ловит «тёмный элемент
          //    в светлой теме» (как был баннер установки).
          selector: `Literal[value=/^#(${THEME_HEX})$/i]`,
          message: 'Хардкод цвета темы — используй var(--bg/surface/surface2/line/ink/mut), иначе сломается светлая тема.',
        },
        {
          // 2) Русский текст-литерал в JSX-пропсах вместо t() → ломает en/es.
          selector: 'JSXAttribute Literal[value=/[а-яА-ЯёЁ]/]',
          message: 'Русский текст в JSX — заведи ключ в i18n.js и выводи через t(), иначе на en/es останется русский.',
        },
        {
          // …и русский текст прямо между тегами (<div>Текст</div>).
          selector: 'JSXText[value=/[а-яА-ЯёЁ]/]',
          message: 'Русский текст в JSX — заведи ключ в i18n.js и выводи через t().',
        },
      ],
    },
  },
  {
    // Легитимные определения тем и canvas-рендер (CSS-переменных там нет):
    // guest-темы и шаринг-карточки хардкодят цвета намеренно. TgNativeBridge —
    // отдельная тёмная страница-мост (рендерится вне PadelLeague, где инжектятся
    // var(--...)), поэтому цвета там тоже хардкод по необходимости.
    files: ['src/components/publicChrome.jsx', 'src/lib/shareCard.js', 'src/components/TgNativeBridge.jsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // i18n.js — это и есть словарь: русский текст здесь по определению.
    files: ['src/lib/i18n.js', 'src/components/AdminCreateUser.jsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
])
