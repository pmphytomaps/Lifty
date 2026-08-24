/** Component/render tests. Pure logic tests stay on vitest (see vitest.config.ts). */
module.exports = {
  preset: 'jest-expo',
  testTimeout: 30000,
  testMatch: ['<rootDir>/tests-ui/**/*.test.tsx'],
  setupFiles: ['<rootDir>/tests-ui/setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests-ui/setup-after-env.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|zustand))',
  ],
};
