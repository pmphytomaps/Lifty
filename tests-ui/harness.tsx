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
