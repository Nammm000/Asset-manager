import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { vi } from 'vitest';
import { useLanguageStore as languageStoreStatic, useT as useTStatic } from 'store/language-store';
import type { useLanguageStore as LanguageStore } from 'store/language-store';

const STORAGE_KEY = 'asset-manager.language';

// Ported from language.service.spec.ts. Tests that need fresh module init
// (stored-choice restore) use vi.resetModules + dynamic import; the useT()
// relabel test uses the statically imported instance so the hook and the
// setLanguage call share one store.
let languageStore: typeof LanguageStore;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('lang');
});

afterEach(() => {
  localStorage.clear();
});

describe('language store', () => {
  it('defaults to English when nothing is stored', async () => {
    vi.resetModules();
    ({ useLanguageStore: languageStore } = await import('store/language-store'));

    expect(languageStore.getState().language).toBe('en');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });

  it('restores a stored "vi" choice and applies the lang attribute at init', async () => {
    localStorage.setItem(STORAGE_KEY, 'vi');
    vi.resetModules();
    ({ useLanguageStore: languageStore } = await import('store/language-store'));

    expect(languageStore.getState().language).toBe('vi');
    expect(document.documentElement.getAttribute('lang')).toBe('vi');
  });

  it('setLanguage applies AND persists — the only path that writes storage', async () => {
    vi.resetModules();
    ({ useLanguageStore: languageStore } = await import('store/language-store'));

    languageStore.getState().setLanguage('vi');

    expect(languageStore.getState().language).toBe('vi');
    expect(document.documentElement.getAttribute('lang')).toBe('vi');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('vi');
  });

  it('useT() relabels live when the language switches', () => {
    const { result } = renderHook(() => useTStatic());
    const english = result.current('common.settings');
    expect(english.length).toBeGreaterThan(0);

    act(() => {
      languageStoreStatic.getState().setLanguage('vi');
    });

    expect(result.current('common.settings')).not.toBe(english);
  });
});
