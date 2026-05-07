// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/** @type {import('typescript-eslint').ConfigArray} */
export default [
  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended rules (handles parser + plugin automatically)
  ...tseslint.configs.recommended,

  // Project-wide rule overrides
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Global ignores
  {
    ignores: ['node_modules/**', '**/dist/**', '.next/**', '**/.next/**', '.turbo/**', '**/.turbo/**', '**/*.mjs'],
  },
]
