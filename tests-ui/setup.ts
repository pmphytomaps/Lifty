/// <reference types="jest" />
/* eslint-disable @typescript-eslint/no-require-imports */
// Native modules the screens touch but a test renderer cannot provide.
jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => {} }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => false, shareAsync: async () => {} }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: async () => ({ canceled: true }) }));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: async () => ({ granted: true }),
  requestPermissionsAsync: async () => ({ granted: true }),
  scheduleNotificationAsync: async () => 'id',
  cancelScheduledNotificationAsync: async () => {},
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));
jest.mock('expo-font', () => ({ useFonts: () => [true, null], isLoaded: () => true }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: async () => {}, hideAsync: async () => {} }));

jest.mock('expo-router', () => {
  const push = jest.fn();
  const back = jest.fn();
  const replace = jest.fn();
  const dismissAll = jest.fn();
  return {
    router: { push, back, replace, dismissAll, canDismiss: () => true, dismissTo: jest.fn() },
    useRouter: () => ({ push, back, replace }),
    useLocalSearchParams: () => (global as Record<string, unknown>).__routeParams ?? {},
    useFocusEffect: (cb: () => void | (() => void)) => {
      const React = require('react');
      React.useEffect(() => cb(), []);
    },
    Stack: { Screen: () => null },
    Tabs: Object.assign(() => null, { Screen: () => null }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 12, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
}));

// Async state settling inside waitFor produces act() noise that drowns real output.
const realError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('not wrapped in act(')) return;
  realError(...args);
};
