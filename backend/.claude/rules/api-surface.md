---
description: REST API surface — endpoint map per controller, DTO conventions, and per-endpoint authorization
globs:
  - "src/main/java/**/controllers/**"
alwaysApply: false
---

# API Surface

Controllers live in `controllers/`. "My X" endpoints resolve the current user via `UserUtils.getCurrentUser()`; per-resource authorization is `UserUtils.checkOwnership` in services.

## API Table

### Authentication — `/auth`

| Method | Endpoint                | Parameters                                         | Description                                                                                       | Auth   |
| ------ | ----------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| POST   | `/auth/login`           | body: `AuthenticationDTO` `{email, password}`      | Authenticates user, returns `AuthenticationResponse` `{jwtToken}`; 404 via sendError if user disabled | Public |
| POST   | `/auth/signup`          | body: `SignupDTO` `{name, email, phone, password}` | Creates user (default BASIC `AccountLevel`, `ACC-<uuid>` account number), returns `UserDTO` (201) | Public |
| POST   | `/auth/logout`          | body: `{email}`                                    | Clears the SecurityContext, returns `LogoutResponse`                                              | JWT    |
| POST   | `/auth/forgot-password` | body: `{email}`                                    | Emails credentials via Gmail SMTP; same neutral response whether or not the user exists           | Public |
| POST   | `/auth/change-password` | body: `{oldPassword, newPassword}`                 | Changes password of the current authenticated user                                                | JWT    |
| GET    | `/auth/hello`           | —                                                  | Health check, returns `"Hello"`                                                                   | Public |

### User management — `/users` (all ADMIN)

| Method | Endpoint             | Parameters                                              | Description                                  | Auth  |
| ------ | -------------------- | ------------------------------------------------------- | -------------------------------------------- | ----- |
| GET    | `/users`             | —                                                       | Lists all users as `UserWrapper` projections | ADMIN |
| PATCH  | `/users/{id}/status` | path: `id`; body: `{status}`                            | Updates user status (enable/disable)         | ADMIN |
| PATCH  | `/users/{id}/role`   | path: `id`; body: `{role}` (`ROLE_USER` / `ROLE_ADMIN`) | Updates user role                            | ADMIN |
| DELETE | `/users/{id}`        | path: `id`                                              | Deletes user                                 | ADMIN |

### Currency — `/currencies` (reference data, String code id)

| Method | Endpoint             | Parameters                                                | Description               | Auth  |
| ------ | -------------------- | --------------------------------------------------------- | ------------------------- | ----- |
| GET    | `/currencies`        | —                                                         | Lists all currencies      | JWT   |
| GET    | `/currencies/{code}` | path: `code` (3-char)                                     | Gets one currency by code | JWT   |
| POST   | `/currencies`        | body: `CurrencyDTO` `{code, name, symbol, decimalPlaces}` | Creates currency          | ADMIN |
| PUT    | `/currencies/{code}` | path: `code`; body: `CurrencyDTO`                         | Updates currency          | ADMIN |
| DELETE | `/currencies/{code}` | path: `code`                                              | Deletes currency          | ADMIN |

### Savings passbooks — `/savings-passbooks` (owner-scoped)

| Method | Endpoint                  | Parameters                                                                      | Description                                                                             | Auth |
| ------ | ------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---- |
| GET    | `/savings-passbooks`      | query: `page` (default 0), `size` (default 10)                                  | Lists current user's passbooks, paged (`PagedResponseDTO`), sorted by `withdrawalDate` DESC falling back to `maturityDate` when not withdrawn | JWT  |
| GET    | `/savings-passbooks/{id}` | path: `id`                                                                      | Gets one passbook (ownership checked)                                                   | JWT  |
| POST   | `/savings-passbooks`      | body: `SavingsPassbookDTO` `{principalAmount, interestRate, maturityDate, ...}` | Creates passbook (generated passbook number) + initial `AdditionalDeposit` linked to it | JWT  |
| PUT    | `/savings-passbooks/{id}` | path: `id`; body: `SavingsPassbookDTO`                                          | Updates passbook                                                                        | JWT  |
| DELETE | `/savings-passbooks/{id}` | path: `id`                                                                      | Deletes passbook                                                                        | JWT  |

### Land assets — `/land-assets` and Other assets — `/other-assets` (owner-scoped)

| Method | Endpoint                         | Parameters                             | Description                        | Auth |
| ------ | -------------------------------- | -------------------------------------- | ---------------------------------- | ---- |
| GET    | `/land-assets` · `/other-assets` | query: `page` (default 0), `size` (default 10) | Lists current user's assets, paged (`PagedResponseDTO`), sorted by `createdAt` DESC | JWT  |
| GET    | `/{id}`                          | path: `id`                             | Gets one asset (ownership checked) | JWT  |
| POST   | `/land-assets` · `/other-assets` | body: `LandAssetDTO` / `OtherAssetDTO` | Creates asset                      | JWT  |
| PUT    | `/{id}`                          | path: `id`; body: DTO                  | Updates asset                      | JWT  |
| DELETE | `/{id}`                          | path: `id`                             | Deletes asset                      | JWT  |

### Cash assets — `/cash-assets` (owner-scoped; a user may have several)

| Method | Endpoint            | Parameters                                  | Description                                                                                          | Auth |
| ------ | ------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---- |
| GET    | `/cash-assets`      | query: `page` (default 0), `size` (default 10) | Lists current user's cash assets with balances, paged (`PagedResponseDTO`), sorted by `createdAt` DESC | JWT  |
| GET    | `/cash-assets/{id}` | path: `id`                                  | Gets one cash asset (ownership checked)                                                              | JWT  |
| POST   | `/cash-assets`      | body: `CashAssetDTO` `{name, description}`  | Creates a new cash asset (`name` required, returns 201). Balances are added separately via `/cash-balances` | JWT  |
| DELETE | `/cash-assets/{id}` | path: `id`                                  | Deletes cash asset (cascades balances)                                                               | JWT  |

### Cash balances — `/cash-balances` (owner-scoped; one row per cash asset + currency)

| Method | Endpoint                   | Parameters                                                   | Description                                                                                                                             | Auth |
| ------ | -------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| GET    | `/cash-balances`           | query: `cashAssetId` (optional), `page` (default 0), `size` (default 10) | Lists current user's balances, optionally filtered by cash asset (ownership checked when filtering), paged (`PagedResponseDTO`), sorted by `id` DESC | JWT  |
| GET    | `/cash-balances/{id}`      | path: `id`                                                   | Gets one balance (ownership checked)                                                                                                    | JWT  |
| POST   | `/cash-balances`           | body: `CashBalanceDTO` `{cashAssetId, currencyCode, amount}` | Creates a balance on an owned cash asset (`amount` ≥ 0); duplicate currency rejected by the `(cashAsset, currency)` unique constraint    | JWT  |
| POST   | `/cash-balances/{id}`      | path: `id`; body: `CashBalanceDTO` `{cashAssetId, currencyCode, amount}` | Adds `amount` to the balance (negative subtracts); `currencyCode` must match the balance's currency (see `asset-business-rules.md`) | JWT  |
| PUT    | `/cash-balances/{id}`      | path: `id`; body: `CashBalanceDTO` `{amount}`                | Sets the balance to a new amount (`amount` ≥ 0)                                                                                          | JWT  |
| DELETE | `/cash-balances/{id}`      | path: `id`                                                   | Deletes balance                                                                                                                          | JWT  |

### Additional deposits — `/additional-deposits`

| Method | Endpoint               | Parameters                                                                                         | Description                                                                                                                                                                    | Auth |
| ------ | ---------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| POST   | `/additional-deposits` | body: `AdditionalDepositRequestDTO` `{email, phone, accountNumber, savingsPassbookNumber, amount}` | Deposits into a passbook identified by user info + passbook number; amount is added to `principalAmount`; returns updated `SavingsPassbookDTO` (see `asset-business-rules.md`) | JWT  |

Conventions:

- DTO in / DTO out via `ResponseEntity` (`dto/` classes). Plain-string message responses go through `AssetUtils.getResponseEntity`.
- Paged list endpoints (the five owner-scoped GETs above) take `page`/`size` query params and return `PagedResponseDTO<T>` `{content, page, size, totalElements, totalPages, first, last}`. Sorts are fixed server-side; invalid paging (e.g. negative page) fails `PageRequest.of` → `IllegalArgumentException` → 400 via the catch-all handler.
- Controllers are thin: no try/catch, no business logic — services throw and `AllExceptionHandler` renders errors (see `exception-handling.md`).
- Per-resource authorization is `UserUtils.checkOwnership(asset)` inside services on every by-id read/update/delete.
