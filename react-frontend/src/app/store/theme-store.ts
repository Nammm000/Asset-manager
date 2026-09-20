import { create } from 'zustand';

export type Theme = 'light' | 'dark';

/**
 * Two-state theme state. Resolution: stored explicit choice → OS preference → light.
 * ONLY an explicit toggle persists (setTheme/toggle write localStorage); the OS
 * preference is followed live (matchMedia change listener) until the first
 * explicit choice is stored, after which the listener is disarmed.
 *
 * Convention shared with the no-flash inline script in index.html and
 * src/scss/theme.scss (they cannot import this constant — keep in sync):
 *   localStorage key 'asset-manager.theme' (values 'light' | 'dark')
 *   attribute data-theme on document.documentElement
 */
const STORAGE_KEY = 'asset-manager.theme';

interface ThemeState {
  theme: Theme;
  setTheme(theme: Theme): void;
  toggle(): void;
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme: resolveInitialTheme(),

  /** Explicit choice: applies AND persists — the only path that writes storage. */
  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  },

  toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}));

function resolveInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return systemPrefersDark() ? 'dark' : 'light';
}

// typeof guard: jsdom does not implement matchMedia — without it, merely
// importing this module in unit tests would throw.
function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

// Module init (the Angular root-service constructor): re-apply idempotently —
// the inline script in index.html already set the attribute pre-paint with
// identical resolution logic — then attach the OS-change listener.
applyTheme(useThemeStore.getState().theme);
listenForSystemChanges();

/**
 * Follow OS-level theme changes live while the user has never made an
 * explicit choice. The listener stays attached for the app's lifetime and
 * self-disarms: any stored value short-circuits it, and toggle() always stores.
 */
function listenForSystemChanges(): void {
  if (typeof window.matchMedia !== 'function') {
    return;
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    if (localStorage.getItem(STORAGE_KEY) !== null) {
      return;
    }
    const theme: Theme = event.matches ? 'dark' : 'light';
    useThemeStore.setState({ theme });
    applyTheme(theme);
  });
}

/** Selector for the old isDark computed. */
export const selectIsDark = (state: ThemeState): boolean => state.theme === 'dark';
