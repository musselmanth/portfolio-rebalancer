import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/'] },
  js.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }], 'no-unused-vars': ['error', { caughtErrors: 'none' }] },
  },
];
