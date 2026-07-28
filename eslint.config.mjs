// ESLint (flat config) — butun monorepo uchun.
// Avval `lint` skripti faqat `tsc --noEmit` edi, ya'ni TIP tekshiruvi; haqiqiy lint
// (ishlatilmagan o'zgaruvchi, yutilgan promise, `any` va h.k.) umuman yo'q edi.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.expo/**',
      'apps/driver-app/**', // mustaqil Expo loyihasi (o'z tooling'i)
      'data/**',
      'eslint.config.mjs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // --- Backend / kutubxonalar (Node) ---
  {
    files: ['apps/api/**/*.ts', 'apps/bot/**/*.ts', 'packages/shared/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      // Boshi `_` bo'lgan argumentlar ataylab ishlatilmaydi (masalan `_req`).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // TTY'da yutilgan promise = yo'qolgan zakaz/pul. Aniq `void`/`catch` talab qilamiz.
      '@typescript-eslint/no-floating-promises': 'off', // type-aware lint yoqilmagan (pastga qarang)
      'no-console': 'off', // NestJS Logger ishlatiladi; skriptlarda console kerak
    },
  },

  // --- Admin (React + brauzer) ---
  {
    files: ['apps/admin/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // --- Node konfiguratsiya fayllari (CommonJS) ---
  {
    files: ['**/jest.config.js', '**/*.cjs'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs',
    },
  },

  // --- Testlar (Jest globallari) ---
  {
    files: ['**/*.spec.ts'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
  },

  // --- Sim/demo skriptlari (JS, Node) ---
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      // Skriptlarda `(a++, console.log(...))` vergul-ifodasi keng ishlatilgan —
      // ishlayotgan test kodini uslub uchun qayta yozmaymiz.
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
);
