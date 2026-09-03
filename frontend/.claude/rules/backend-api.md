---
description: Backend REST contract — auth endpoints, asset/user/currency endpoint map, JWT bearer auth, PagedResponseDTO, and the backend's three error body shapes
globs:
  - "src/app/service/**"
  - "src/app/model/**"
  - "src/app/util/**"
  - "src/app/component/modal-form/**"
alwaysApply: false
---

# Backend API Contract

The Spring Boot backend runs on port 8081 (`environment.apiUrl`, stateless JWT bearer auth). Every frontend service in `src/app/service/` maps 1:1 to a resource below; DTO interfaces in `src/app/model/` mirror the backend and document per-field quirks in doc comments.

- **Auth** (`AuthService`): `POST /auth/login` `{email, password}` → `{accessToken}` + HttpOnly refresh cookie; `POST /auth/signup` `{name, email, phone, password}` → `{accessToken}` + cookie (the backend auto-logs-in the new user — no `UserDto` anymore); `POST /auth/refresh` **no body** (public, cookie-authenticated) → `{accessToken}` + rotated cookie — rotation deletes the old refresh token server-side, so replaying it 401s (the failed refresh also clears the cookie); `POST /auth/logout` **no body** (JWT-protected; the cookie identifies the token to revoke, which the server also clears); `POST /auth/forgot-password` `{email}`; `POST /auth/change-password` `{oldPassword, newPassword}` (revokes all refresh tokens and clears the cookie); `GET /auth/hello` (plain text). All `/auth/*` requests are sent `withCredentials` so the cookie flows cross-origin.
- **Assets** (all user-scoped, JWT required): `/savings-passbooks`, `/land-assets`, `/other-assets` — paged `GET`, `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}` → `MessageResponse`. `/cash-assets` — same minus PUT. `/cash-balances` — paged GET, `GET /{id}`, `POST` create, `POST /{id}` adjust (signed amount, negative subtracts), `PUT /{id}` `{amount}`, `DELETE /{id}`. `/additional-deposits` — `POST` only (email/phone must match account records) → updated `SavingsPassbook`.
- **Currencies** (`CurrencyService`): non-paged `GET` list, `GET/{code}`, `POST`, `PUT /{code}`, `DELETE /{code}`. Writes are ADMIN-only.
- **Users** (`UserService`, ADMIN-only): non-paged `GET` list, `PATCH /{id}/status`, `PATCH /{id}/role`, `DELETE /{id}`.
- **Pagination**: list endpoints return `PagedResponseDTO {content, page, size, totalElements, totalPages, first, last}` (frontend: `model/paged-response.model.ts`, with `PageParams {page?, size?}`).
- **Error bodies come in three shapes** — the global handler's `{status, message, timeStamp}`, the hand-rolled `{"messag": "..."}` (key really is misspelled on the backend; do not "fix" the frontend mirror), and bare strings. `util/api-util.ts` `getApiErrorMessage()` normalizes all three.
- **JWT**: claims are `{sub: email, role, iat, exp, typ: 'access'}`; roles are `ROLE_USER | ROLE_ADMIN | ROLE_CUSTOMER`. Access tokens live **15 minutes** and are stored memory-only client-side (never localStorage); the opaque 64-hex refresh token (7-day server-side expiry) lives exclusively in the HttpOnly `asset-manager.refreshToken` cookie (`SameSite=Strict`, `Path=/auth` — invisible to JS, so the client learns session state only by attempting a refresh). Expired/invalid Bearer headers get a clean 401 `ErrorResponseDTO` (even on public endpoints) — hence the interceptor only attaches live tokens and refreshes proactively (see `architecture.md`).
- Full endpoint map: `../backend/.claude/rules/api-surface.md`; JWT details: `../backend/.claude/rules/security-auth.md`; asset business rules: `../backend/.claude/rules/asset-business-rules.md`.
