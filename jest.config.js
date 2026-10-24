const expoPreset = require('jest-expo/jest-preset');

// Packages shipped as untranspiled ESM/JSX that Jest must transform, on top
// of the jest-expo defaults.
const TRANSFORM = [
  'nativewind',
  'react-native-css-interop',
  'react-native-svg',
  '@rn-primitives',
  'lucide-react-native',
];

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  resolver: '<rootDir>/jest.resolver.js',
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}', '<rootDir>/scripts/**/*.test.js'],
  transformIgnorePatterns: [
    expoPreset.transformIgnorePatterns[0].replace('(?!(', `(?!(${TRANSFORM.join('|')}|`),
    ...expoPreset.transformIgnorePatterns.slice(1),
  ],
  // The same Babel transform for .mjs (lucide-react-native ships ESM as .mjs).
  transform: {
    ...expoPreset.transform,
    '\\.mjs$': expoPreset.transform['\\.[jt]sx?$'],
  },
  // jest-expo maps the tsconfig paths in declaration order: put the most
  // specific alias (@/assets) first so it wins over @/*.
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    ...expoPreset.moduleNameMapper,
  },
  clearMocks: true,
};
