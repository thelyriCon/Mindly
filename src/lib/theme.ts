/**
 * Mindly Global Theme Controller
 * Manages switching between 'deep-space' (default cosmic dark theme)
 * and 'light-mode' (high-contrast WCAG AAA accessibility light theme)
 * using CSS variables and root attributes.
 */

import { setUserPreferences, getUserPreferences } from './persistence';

export type ThemeMode = 'deep-space' | 'light-mode';

export const THEME_STORAGE_KEY = 'mindly_theme';
export const THEME_CHANGE_EVENT = 'mindly-theme-change';

/**
 * Reads the current saved theme from localStorage,
 * falling back to persistence preferences, or 'deep-space' by default.
 */
export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'deep-space';

  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light-mode' || saved === 'light') return 'light-mode';
    if (saved === 'deep-space' || saved === 'dark') return 'deep-space';

    // Check user preferences in persistence
    const prefs = getUserPreferences();
    if (prefs.theme === 'light') return 'light-mode';
  } catch (err) {
    console.warn('[Theme] Could not read stored theme:', err);
  }

  return 'deep-space';
}

/**
 * Applies the specified theme to the DOM document and saves to storage.
 * Directly toggles root data-theme attribute, .theme-light class,
 * and updates browser theme-color meta tag.
 */
export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;

  const isLight = theme === 'light-mode';
  const root = document.documentElement;

  // 1. Set data-theme attribute on root element for CSS variables
  root.setAttribute('data-theme', isLight ? 'light' : 'deep-space');

  // 2. Toggle class for class-based CSS rules
  if (isLight) {
    root.classList.add('theme-light');
    root.classList.remove('theme-deep-space');
    root.style.colorScheme = 'light';
  } else {
    root.classList.remove('theme-light');
    root.classList.add('theme-deep-space');
    root.style.colorScheme = 'dark';
  }

  // 3. Update mobile browser address bar / notch theme color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', isLight ? '#f8fafc' : '#07132b');
  }

  // 4. Persist to localStorage
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    setUserPreferences({ theme: isLight ? 'light' : 'dark' });
  } catch (err) {
    console.warn('[Theme] Failed to persist theme:', err);
  }

  // 5. Notify all listeners/components across the app
  window.dispatchEvent(
    new CustomEvent(THEME_CHANGE_EVENT, {
      detail: { theme, isLight },
    })
  );
}

/**
 * Toggles between 'deep-space' and 'light-mode'.
 */
export function toggleTheme(): ThemeMode {
  const current = getStoredTheme();
  const next: ThemeMode = current === 'deep-space' ? 'light-mode' : 'deep-space';
  applyTheme(next);
  return next;
}

/**
 * Bootstraps the theme immediately upon script evaluation.
 */
export function initTheme(): ThemeMode {
  const initial = getStoredTheme();
  applyTheme(initial);
  return initial;
}
