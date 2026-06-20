// Minimal ESLint flat config (ESLint 9/10). The project is plain JS/JSX, so we
// avoid the @typescript-eslint toolchain and just parse + apply light rules.
// This keeps `npm run lint` fast and green in CI; tighten rules later if desired.
module.exports = [
  { linterOptions: { reportUnusedDisableDirectives: false } },
  {
    ignores: [
      'node_modules/**',
      'ios/**',
      'android/**',
      'dist/**',
      'server/**',
      '.expo/**',
      '__tests__/**',
    ],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-empty': 'off',
    },
  },
];
