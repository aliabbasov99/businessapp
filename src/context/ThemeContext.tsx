import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getColors, type ThemeName } from '@/constants/theme';

type ThemeContextValue = {
  theme: ThemeName;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemeName) => void;
  colors: ReturnType<typeof getColors>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'promar.theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(value => {
        if (!mounted) return;
        if (value === 'light' || value === 'dark') {
          setThemeState(value);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setTheme = (next: ThemeName) => {
    setThemeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  };
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  const value: ThemeContextValue = {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setTheme,
    colors: getColors(theme),
  };

  if (!ready) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
