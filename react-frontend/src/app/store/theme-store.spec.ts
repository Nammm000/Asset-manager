import { vi } from 'vitest';
import type { useThemeStore as ThemeStore } from 'store/theme-store';

const STORAGE_KEY = 'asset-manager.theme';

// Ported from theme.service.spec.ts. The store applies the theme and attaches
// the matchMedia listener at module init, so each test stubs matchMedia FIRST
// (capturing the change listener), then re-imports the module fresh.
interface CapturedMediaQuery {
  matches: boolean;
  addEventListener: (type: string, listener: (event: { matches: boolean }) => void) => void;
}

let themeStore: typeof ThemeStore;
let changeListeners: ((event: { matches: boolean }) => void)[];
let mediaMatches: boolean;

function stubMatchMedia(): void {
  changeListeners = [];
  mediaMatches = false;
  window.matchMedia = ((query: string) => ({
    matches: mediaMatches,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => changeListeners.push(listener),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

async function importFresh(): Promise<void> {
  vi.resetModules();
  ({ useThemeStore: themeStore } = await import('store/theme-store'));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  stubMatchMedia();
});

afterEach(() => {
  localStorage.clear();
});

describe('theme store', () => {
  it('resolves a stored explicit choice over the OS preference', async () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    mediaMatches = true; // OS says dark — the stored choice wins
    await importFresh();

    expect(themeStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('follows the OS preference when nothing is stored', async () => {
    mediaMatches = true;
    await importFresh();

    expect(themeStore.getState().theme).toBe('dark');
  });

  it('defaults to light with no stored choice and no OS preference', async () => {
    await importFresh();

    expect(themeStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('setTheme applies AND persists — the only path that writes storage', async () => {
    await importFresh();

    themeStore.getState().setTheme('dark');

    expect(themeStore.getState().theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('toggle flips between the two states and persists', async () => {
    await importFresh();

    themeStore.getState().toggle();
    expect(themeStore.getState().theme).toBe('dark');
    themeStore.getState().toggle();
    expect(themeStore.getState().theme).toBe('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('follows OS-level changes live while no explicit choice is stored', async () => {
    await importFresh();
    expect(changeListeners.length).toBeGreaterThan(0);

    changeListeners.forEach((listener) => listener({ matches: true }));

    expect(themeStore.getState().theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('self-disarms the OS listener after the first explicit choice is stored', async () => {
    await importFresh();
    themeStore.getState().setTheme('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');

    changeListeners.forEach((listener) => listener({ matches: true }));

    // The stored choice short-circuits the listener — theme unchanged.
    expect(themeStore.getState().theme).toBe('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });
});
