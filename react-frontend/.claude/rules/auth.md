---
paths:
  - "src/app/store/auth-store*"
  - "src/app/core/api-client*"
  - "src/app/service/user-image*"
  - "src/app/util/auth-util.ts"
  - "src/app/util/jwt-util*"
---

# Auth & session

- The access token is **memory-only** (gone on reload); the refresh token is an **HttpOnly cookie** JS can't read, so `sessionActive` is the presence flag.
- Refresh is **single-flight** (module-private promise) because the backend rotates tokens — concurrent refreshes would 401.
- `restoreSession()` blind-refreshes at startup (401 = normal guest).
- `sessionExpired()` clears state and opens the login modal.
- `applyAuthenticationResponse()` is public on purpose — specs use it to seed sessions.
- With selectors, select values (`selectEmail`, `selectRole`, `selectIsAdmin`), never bare action refs.

JWT claim shape and role values are in `backend-contract.md`.
