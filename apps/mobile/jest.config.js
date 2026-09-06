/**
 * jest-expo supplies the React Native transform and module mocks; the plain
 * Jest defaults cannot parse the ESM that ships inside expo and react-native.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-paper|standard-navigation))',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
};
