---
description: Layered architecture — controllers, services, repos, and cross-cutting filters/security/exception handling
alwaysApply: true
---

# Architecture

Standard layered structure: `controllers` → `services` (per domain: `auth`, `user`, `jwt`, `currency`, `asset` — the last holds CashAsset, CashBalance, SavingsPassbook, AdditionalDeposit, LandAsset, OtherAsset services) → `repo` (Spring Data JPA) → PostgreSQL.

Cross-cutting pieces:

- `filters/JwtRequestFilter`
- `configuration/WebSecurityConfiguration`
- `configuration/RedisCacheConfig` (Redis-backed Spring cache: `@Cacheable` on the savings-passbook paged list keyed by JWT username + page + size, and on the by-ID GET keyed by username + id; `@CacheEvict(allEntries)` on both caches for every passbook write path + additional deposit + user delete; Jackson serializer with default typing; errors degrade to DB). `services/asset/SavingsPassbookBloomFilter` (Guava, in-memory, fail-open) guards both read paths against cache penetration — see `docs/redis.md` §6 and `docs/redisson-bloom-filter.md` for the distributed alternative.
- `exception/AllExceptionHandler` (global @ControllerAdvice, see `exception-handling.md`)
- `dto/` for request/response shapes
- `wrapper/` for query projections (e.g. `UserWrapper`)
- `util/` — `UserUtils` (current-user resolution + asset ownership checks), `AssetUtils` (response helpers), `JwtUtil`, `EmailUtil`, `TimeUtil`

Endpoint map and controller conventions: see `api-surface.md`. Service behavior rules: see `asset-business-rules.md`.