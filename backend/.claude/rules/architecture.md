---
description: Layered architecture — controllers, services, repos, and cross-cutting filters/security/exception handling
alwaysApply: true
---

# Architecture

Standard layered structure: `controllers` → `services` (per domain: `auth`, `user`, `jwt`, `currency`, `asset` — the last holds CashAsset, CashBalance, SavingsPassbook, AdditionalDeposit, LandAsset, OtherAsset services) → `repo` (Spring Data JPA) → PostgreSQL.

Cross-cutting pieces:

- `filters/JwtRequestFilter`
- `configuration/WebSecurityConfiguration`
- `exception/AllExceptionHandler` (global @ControllerAdvice, see `exception-handling.md`)
- `dto/` for request/response shapes
- `wrapper/` for query projections (e.g. `UserWrapper`)
- `util/` — `UserUtils` (current-user resolution + asset ownership checks), `AssetUtils` (response helpers), `JwtUtil`, `EmailUtil`, `TimeUtil`

Endpoint map and controller conventions: see `api-surface.md`. Service behavior rules: see `asset-business-rules.md`.