---
paths:
  - "src/**/*.spec.ts"
  - "src/**/*.spec.tsx"
  - "src/test/**"
---

# Testing

- Tests drive stores directly (`store.getState().someAction()`) and assert via `getState()` or the DOM; URLs are asserted against `${environment.apiUrl}/...`.

## Spec recipe (fetch mock + resetModules)

Most specs follow the idiom in `src/app/store/auth-store.spec.ts`:

```ts
beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  ({ useAuthStore: authStore } = await import('store/auth-store')); // dynamic import re-runs
});                                                                  // module-init side effects
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});
```

Queue `fetchMock.mockResolvedValueOnce(jsonResponse(...))` in the order the page's mount effect fires requests. `src/test/helpers.ts` provides `makeToken` (builds real JWTs), `authResponse`, `unauthorized`, `jsonResponse` (a real fetch `Response` for the stubbed global), and `flushPromises`. `src/test/setup.ts` stubs `window.matchMedia` and clears `data-theme`/`lang` after each test. Components that use routing render inside `<MemoryRouter>`.
