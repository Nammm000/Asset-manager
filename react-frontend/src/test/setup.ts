import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

// jsdom lacks matchMedia (the Angular specs stubbed it per-suite for the theme
// listener tests; this benign default keeps unrelated specs green). Specs that
// need to capture the change listener re-stub it via vi.stubGlobal.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('lang');
});
