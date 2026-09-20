# CLAUDE.md

React 19 + Vite + TypeScript (strict) port of the Angular app in `../frontend` — same features, same backend contract, same SCSS/design. Pairs with the Spring Boot backend in `../backend` (port 8082, endpoints at root — no `/api` prefix). `README.md` holds the Angular→React mapping table.

Detailed working rules live in `.claude/rules/` as one-topic-per-file rules. Files without `paths` frontmatter load every session; the rest attach automatically when touching files that match their globs.

| Rule file | Loads when touching | Topic |
| --- | --- | --- |
| `commands.md` | — always | npm scripts, port 4200, runtime config, full-stack (docker / JDK 17 / mvn) |
| `architecture.md` | — always | `src/` layout, bootstrap order in `main.tsx` |
| `typescript-conventions.md` | — always | bare imports (dual alias config), naming, strict TS, build as only check |
| `http-client.md` | `src/app/core/**` | `rawRequest` + `apiRequest` phases, one-way dependency |
| `auth.md` | auth-store, api-client, user-image, auth/jwt utils | memory-only token, single-flight refresh, selectors |
| `modals-and-forms.md` | `src/app/component/**`, app.tsx, modal-store | permanently-mounted modals, `openConfirmation`, derived form validation |
| `routing-and-guards.md` | routes.tsx, `guard/`, use-page-title | lazy pages, guards, no /login route |
| `services.md` | `src/app/service/**` | async-function services, `remove`/`deleteMany`, user-image blob |
| `backend-contract.md` | `model/`, `service/`, api-util | do-NOT-fix backend quirks (`messag`, `PagedResponse`, roles, rate limits) |
| `theming-and-styling.md` | `*.scss`, index.html, theme-store | color tokens only in theme.scss, three-place theme sync |
| `i18n.md` | `i18n/`, language-store | `en`/`vi`, `useT()`, `vi` typed key map |
| `notifications.md` | notification-store | WebSocket sync, backoff, zombie-socket recycling |
| `local-storage.md` | `store/`, index.html | `asset-manager.*` keys, legacy purge |
| `testing.md` | `*.spec.*`, `src/test/` | spec recipe (fetch mock + resetModules), helpers |
