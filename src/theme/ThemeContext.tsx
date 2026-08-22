import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '../state/settings';
import { palette, type ThemeColors } from './tokens';

const ThemeContext = createContext<ThemeColors>(palette.dark);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pref = useSettings((s) => s.theme);
  const system = useColorScheme();
  const colors = useMemo(() => {
    const mode = pref === 'auto' ? (system === 'light' ? 'light' : 'dark') : pref;
    return palette[mode];
  }, [pref, system]);
  return <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeColors {
  return useContext(ThemeContext);
}
