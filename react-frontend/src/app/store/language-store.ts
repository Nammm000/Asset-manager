import { useCallback } from 'react';
import { create } from 'zustand';
import { translations } from 'i18n/translations';
import type { Language, TranslationKey } from 'i18n/translations';

/**
 * Two-state UI language. Resolution: stored explicit choice → English.
 * ONLY setLanguage persists (localStorage 'asset-manager.language', values
 * 'en' | 'vi' — same key convention as theme-store's 'asset-manager.theme').
 */
const STORAGE_KEY = 'asset-manager.language';

interface LanguageState {
  language: Language;
  setLanguage(language: Language): void;
}

export const useLanguageStore = create<LanguageState>()((set) => ({
  language: localStorage.getItem(STORAGE_KEY) === 'vi' ? 'vi' : 'en',

  /** Explicit choice: applies AND persists — the only path that writes storage. */
  setLanguage: (language) => {
    set({ language });
    document.documentElement.setAttribute('lang', language);
    localStorage.setItem(STORAGE_KEY, language);
  },
}));

// Module init (idempotent with index.html's lang="en").
document.documentElement.setAttribute('lang', useLanguageStore.getState().language);

export const selectIsVietnamese = (state: LanguageState): boolean => state.language === 'vi';

/**
 * Translation hook — subscribes to the language slice so views relabel live
 * when the language switches. Never expose t() as a store method: a bare
 * function reference is stable and would never trigger a re-render.
 */
export function useT(): (key: TranslationKey) => string {
  const language = useLanguageStore((state) => state.language);
  return useCallback((key: TranslationKey) => translations[language][key], [language]);
}
