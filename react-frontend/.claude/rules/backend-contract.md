---
paths:
  - "src/app/model/**"
  - "src/app/service/**"
  - "src/app/util/api-util.ts"
---

# Backend contract — do NOT "fix" these

- `MessageResponse { messag }` — the key is misspelled on the backend; the model mirrors it deliberately. `util/api-util.ts` `getApiErrorMessage()` normalizes all three backend error shapes (including `messag`).
- `UserWrapper.status` is the string `"true"`/`"false"`, not a boolean.
- `POST /cash-balances/{id}` adjusts; `PUT /cash-balances/{id}` sets (`adjust` vs `setAmount` in `cash-balance.service.ts`).
- Roles: `ROLE_USER | ROLE_ADMIN | ROLE_CUSTOMER`; JWT claims `{ sub: email, role, iat, exp, typ }`.
- Pagination: `PagedResponse<T>` (`content, page, size, totalElements, totalPages, first, last`); list services default `page = 0, size = 10`.
- Rate limiting: ~3 requests/s per JWT subject or IP (429 + `Retry-After: 1`).
