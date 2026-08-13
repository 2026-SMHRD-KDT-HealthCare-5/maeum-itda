import { reactTypeScriptConfig } from '@maeum-itda/config/eslint'

export default [
  { ignores: ['dist'] },
  ...reactTypeScriptConfig,
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: { self: 'readonly', caches: 'readonly', fetch: 'readonly', URL: 'readonly' },
    },
  },
]
