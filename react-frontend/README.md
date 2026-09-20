# Asset Manager — React frontend

React 19 port of the Angular frontend in `../frontend` (same features, same
backend contract, same design). Pairs with the Spring Boot backend in
`../backend` (port 8082).

## Commands

```bash
npm install
npm run dev        # dev server on http://localhost:4200 (port MUST be 4200 — see below)
npm test           # Vitest + React Testing Library (jsdom)
npm run build      # tsc -b && vite build → dist/
npm run preview    # serve the production build
```

## Why port 4200

The backend's CORS allowlist and the WebSocket allowed-origins both read
`app.client.url=http://localhost:4200` (see
`../backend/src/main/resources/application.properties`). The dev server pins
`server.port: 4200, strictPort: true` in `vite.config.ts` so credentialed HTTP
(the HttpOnly refresh cookie) and the notification WebSocket work without any
backend change. `vite preview` serves on a different origin and will fail
credentialed requests against the backend.

## Architecture (and how it maps to the Angular app)

| Angular | React |
| --- | --- |
| signals + root services | Zustand stores (`src/app/store/`) |
| `AuthService` | `store/auth-store.ts` (memory-only access token, single-flight refresh, restore-before-render in `src/main.tsx`) |
| `authInterceptor` | `core/api-client.ts` (phase-ordered fetch wrapper: Bearer attach, proactive refresh, one-shot 401 retry) |
| `ModalService` + permanently-mounted modals | `store/modal-store.ts` + the 4 modals mounted in `app.tsx` |
| `NotificationService` (WebSocket) | `store/notification-store.ts` + `initNotificationSync()` started from `main.tsx` (outside React) |
| `ThemeService` / `LanguageService` | `store/theme-store.ts` / `store/language-store.ts` (+ `useT()`) |
| `UserImageService` (avatar hydration) | `service/user-image.ts` + `initAvatarSync()` |
| HttpClient services (`*.service.ts`) | async function modules over `apiRequest` (Angular's `delete` method is exported as `remove` — reserved word) |
| `authGuard` / `adminGuard` | `guard/RequireAuth.tsx` / `guard/RequireAdmin.tsx` (denial opens the login modal; there is no /login route) |
| `provideAppInitializer(restoreSession)` | `main.tsx` awaits `restoreSession()` before `createRoot(...).render(...)` |
| template-driven forms with signal computeds | controlled inputs + derived validation (no touched/pristine) |
| `appAutoHideScrollbar` directive | `hooks/use-auto-hide-scrollbar.ts` |

Styling is the same SCSS: `src/scss/{theme,modal,table,page,notification,icon}.scss`
imported globally in import order (theme first), plus per-component scss
imported by the components. Class names are unchanged, so all global chrome
works as before. Theming still rides `data-theme` on `<html>` with the
no-flash inline script in `index.html` (key `asset-manager.theme` — kept in
sync across script, theme-store, and theme.scss).

localStorage keys (unchanged from the Angular app):
`asset-manager.theme`, `asset-manager.language`, `asset-manager.notifications`,
`asset-manager.avatar`. Legacy `asset-manager.token`/`asset-manager.refreshToken`
keys are purged at startup.

## Notes

- Imports keep the Angular bare-specifier convention (`service/x.service`,
  `model/x`, `util/x`, `component/...`, plus new `store/`, `core/`, `hooks/`,
  `guard/`) via tsconfig paths + vite aliases.
- API quirks preserved deliberately: `MessageResponse { messag }` (misspelled
  on the backend), stringly user status `"true"/"false"`,
  `POST /cash-balances/{id}` (adjust) vs `PUT /cash-balances/{id}` (set).
- The Angular app's `.claude/rules` docs were stale relative to its code; this
  port follows the code.
