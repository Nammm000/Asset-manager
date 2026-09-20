# Architecture

React 19 + Vite + TypeScript (strict) port of the Angular app in `../frontend` — same features, same backend contract, same SCSS/design. Pairs with the Spring Boot backend in `../backend` (port 8082, endpoints at root — no `/api` prefix). `README.md` holds the Angular→React mapping table.

```
src/
  main.tsx                     bootstrap (order matters — see below)
  environments/environment.ts  the only runtime config (apiUrl)
  test/{setup,helpers}.ts      Vitest setup + spec helpers
  scss/*.scss                  global chrome; theme.scss holds ALL color tokens
  app/
    routes.tsx                 createBrowserRouter, lazy pages, guards
    app.tsx                    shell: Header + (Sidebar when authed) + 4 mounted modals
    core/                      http.ts (rawRequest) → api-client.ts (auth phases)
    store/                     zustand: auth, modal, theme, language, notification
    service/                   async-function modules over apiRequest (one per resource)
    guard/                     RequireAuth.tsx / RequireAdmin.tsx route wrappers
    hooks/                     use-page-title, use-auto-hide-scrollbar
    util/  model/  i18n/  component/   utils, DTO mirrors, translations, pages + modal-form/ + shared/
```

- **Bootstrap order** (`src/main.tsx`): global SCSS in fixed order (theme.scss first — it defines the tokens) → `await restoreSession()` BEFORE `createRoot().render()` (the session settles before guards decide) → `initNotificationSync()` + `initAvatarSync()` started once, outside React (StrictMode-safe).

Per-subsystem rules live in sibling rule files (`http-client`, `auth`, `modals-and-forms`, `routing-and-guards`, `services`, `theming-and-styling`, `i18n`, `notifications`) and attach automatically when touching matching files.
