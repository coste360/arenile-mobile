// ESLint flat config (eslint-config-expo). Prettier runs separately
// (`npm run format:check`), the style guard in `npm run lint:style`.
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  globalIgnores([
    'dist/*',
    '.expo/*',
    'src/api/generated/*',
    'src/features/day-map/kit/generated/*',
    'coverage/*',
    // Agent worktrees (Claude Code), full copies of the repository.
    '.claude/worktrees/*',
  ]),
  expoConfig,
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Alert'],
              message:
                'Use the Reusables AlertDialog (src/components/ui/alert-dialog), not a native Alert.',
            },
            {
              name: 'react-native',
              importNames: ['Text', 'TextInput', 'Button'],
              message:
                'Use the Reusables components from @/components/ui (theme tokens, variants).',
            },
          ],
        },
      ],
    },
  },
  {
    // Vendored Reusables components wrap the React Native primitives.
    files: ['src/components/ui/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['scripts/**/*.test.js'],
    languageOptions: {
      globals: { describe: 'readonly', it: 'readonly', expect: 'readonly', jest: 'readonly' },
    },
  },
  {
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
    // Node.js build scripts (run by make, never bundled in the app).
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'writable',
      },
    },
    rules: { 'no-console': 'off' },
  },
]);
