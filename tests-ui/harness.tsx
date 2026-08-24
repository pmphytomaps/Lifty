import React from 'react';
import { render } from '@testing-library/react-native';
import { ActionSheetHost } from '../src/components/ActionSheet';
import { DialogHost } from '../src/components/Dialog';
import { ThemeProvider } from '../src/theme/ThemeContext';

/** Mirrors the real root layout: screen plus the dialog and sheet hosts. */
/** RTL's render is async in this version; always await it. */
export function renderScreen(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      {ui}
      <ActionSheetHost />
      <DialogHost />
    </ThemeProvider>,
  );
}

export function setRouteParams(params: Record<string, string>): void {
  (global as Record<string, unknown>).__routeParams = params;
}

/**
 * Poll with plain timers. RTL's async queries become unreliable in later tests
 * in a file — the element is demonstrably present while the polling still times
 * out — so anything order-sensitive uses this instead.
 */
export async function until<T>(probe: () => T | null | undefined, timeoutMs = 4000): Promise<T> {
  const started = Date.now();
  for (;;) {
    const value = probe();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error('condition was never met');
    await new Promise((r) => setTimeout(r, 40));
  }
}

/** Let React flush and pending queries land. Deterministic where polling starves the scheduler. */
export function settle(ms = 700): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
