// ESLint flat config (ESLint 9/10). Extends the official `eslint-config-expo`
// flat preset (Expo + React + React Hooks + TypeScript) so lint actually catches
// real bugs (hook misuse, etc.) instead of being a no-op. Rules are tuned to fail
// CI on hard errors (rules-of-hooks) while keeping noise as warnings.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
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
    files: ['**/*.{js,jsx,ts,tsx}'],
    // Pin the React version so eslint-plugin-react skips its auto-detection path,
    // which crashes under ESLint 10 (getFilename API change). Detection-free.
    settings: {
      react: { version: '19.1.0' },
    },
    rules: {
      // Hook misuse is a real correctness bug — fail CI on it.
      'react-hooks/rules-of-hooks': 'error',
      // Dependency-array issues are warnings (advisory, won't block CI).
      'react-hooks/exhaustive-deps': 'warn',
      // Warn (not error) so the existing codebase doesn't fail en masse.
      'no-unused-vars': 'warn',

      // ── Demote preset error-rules to warnings ──────────────────────────────
      // eslint-config-expo v56 turns on the experimental React Compiler hooks
      // rules and several import/* rules as ERRORS. They flag real-but-advisory
      // patterns across the existing codebase (and false-positive on Deno edge
      // functions / Expo namespace re-exports). We keep them as warnings so they
      // stay visible without making CI "fake green" the other way — rules-of-hooks
      // (the one that catches genuine crashes) remains a hard error.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      // Import-resolution rules can't see Deno URL imports or Expo's namespace
      // re-exports; downgrade to warnings (typecheck still guards real imports).
      'import/namespace': 'warn',
      'import/no-unresolved': 'warn',
      'no-undef': 'warn',
    },
  },
];
