/// <reference types="jest" />
import { cleanup, configure } from '@testing-library/react-native';

// Screens read through an async driver; give assertions room to settle.
configure({ asyncUtilTimeout: 5000 });

// Unmount and let debounced timers and in-flight queries drain before the next
// test swaps the database out from under them. Without this, a test that types
// into a search box leaves work that fails the test after it.
afterEach(async () => {
  await cleanup();
  await new Promise((r) => setTimeout(r, 300));
});
