import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

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
      'no-unused-vars': ['error', { caughtErrors: 'none', varsIgnorePattern: '^_|^React$' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Хелперы рядом с компонентами — осознанный паттерн; правило только про HMR.
      'react-refresh/only-export-components': 'off',
    },
  },
])
