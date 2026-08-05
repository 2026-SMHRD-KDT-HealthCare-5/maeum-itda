// Shared ESLint flat config for this monorepo's TypeScript + React (Vite)
// apps. Each app's own eslint.config.js should spread `reactTypeScriptConfig`
// in and add app-specific bits (e.g. `ignores: ['dist']`) — see
// apps/frontend/eslint.config.js for the pattern. FSD layer-boundary
// enforcement (see apps/frontend/CLAUDE.md's import rule) isn't wired in
// here yet — add an eslint-plugin-boundaries block when that's tackled.
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export const reactTypeScriptConfig = tseslint.config(
  { extends: [js.configs.recommended, ...tseslint.configs.recommended] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  prettier,
)
