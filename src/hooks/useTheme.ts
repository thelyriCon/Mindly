import { useState, useEffect, useCallback } from 'react';
import {
  ThemeMode,
  getStoredTheme,
  applyTheme,
  toggleTheme as toggleGlobalTheme,
  THEME_CHANGE_EVENT,
} from '../lib/theme';

export interface UseThemeResult {
  theme: ThemeMode;
  isLight: boolean;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme);

  useEffect(() => {
    // Initial sync
    const current = getStoredTheme();
    setThemeState(current);

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: ThemeMode; isLight: boolean }>;
      if (customEvent.detail?.theme) {
        setThemeState(customEvent.detail.theme);
      } else {
        setThemeState(getStoredTheme());
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mindly_theme' && e.newValue) {
        setThemeState(getStoredTheme());
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    applyTheme(newTheme);
    setThemeState(newTheme);
  }, []);

  const toggle = useCallback(() => {
    const next = toggleGlobalTheme();
    setThemeState(next);
  }, []);

  return {
    theme,
    isLight: theme === 'light-mode',
    isDark: theme === 'deep-space',
    toggleTheme: toggle,
    setTheme,
  };
}
