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

- **Auth** (`AuthService`): `POST /auth/login` `{email, password}` → `{jwtToken}`; `POST /auth/signup` `{name, email, phone, password}` → `UserDto`; `POST /auth/logout` `{email}`; `POST /auth/forgot-password` `{email}`; `POST /auth/change-password` `{oldPassword, newPassword}`; `GET /auth/hello` (plain text).
- **Assets** (all user-scoped, JWT required): `/savings-passbooks`, `/land-assets`, `/other-assets` — paged `GET`, `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}` → `MessageResponse`. `/cash-assets` — same minus PUT. `/cash-balances` — paged GET, `GET /{id}`, `POST` create, `POST /{id}` adjust (signed amount, negative subtracts), `PUT /{id}` `{amount}`, `DELETE /{id}`. `/additional-deposits` — `POST` only (email/phone must match account records) → updated `SavingsPassbook`.
- **Currencies** (`CurrencyService`): non-paged `GET` list, `GET/{code}`, `POST`, `PUT /{code}`, `DELETE /{code}`. Writes are ADMIN-only.
- **Users** (`UserService`, ADMIN-only): non-paged `GET` list, `PATCH /{id}/status`, `PATCH /{id}/role`, `DELETE /{id}`.
- **Pagination**: list endpoints return `PagedResponseDTO {content, page, size, totalElements, totalPages, first, last}` (frontend: `model/paged-response.model.ts`, with `PageParams {page?, size?}`).
- **Error bodies come in three shapes** — the global handler's `{status, message, timeStamp}`, the hand-rolled `{"messag": "..."}` (key really is misspelled on the backend; do not "fix" the frontend mirror), and bare strings. `util/api-util.ts` `getApiErrorMessage()` normalizes all three.
- **JWT**: claims are `{sub: email, role, iat, exp}`; roles are `ROLE_USER | ROLE_ADMIN | ROLE_CUSTOMER`. Backend rejects expired/malformed tokens with a 500 before authorization rules run — hence the interceptor only sends live tokens.
- Full endpoint map: `../backend/.claude/rules/api-surface.md`; JWT details: `../backend/.claude/rules/security-auth.md`; asset business rules: `../backend/.claude/rules/asset-business-rules.md`.
