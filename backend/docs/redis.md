# Redis in the Backend

Redis is the Spring Cache backing store used for exactly one thing: **the paged savings-passbook list** (`GET /savings-passbooks`). No code talks to Redis directly — everything goes through Spring's cache abstraction (`@Cacheable` / `@CacheEvict`) on a `RedisCacheManager`. The pieces:

- `AssetManagerApplication` — `@EnableCaching(order = 0)` switches proxy-based caching on.
- `configuration/RedisCacheConfig` — the only class that touches Redis APIs: the `RedisCacheManager` bean (TTL + serializer) and a `CacheErrorHandler` for outages.
- `SavingsPassbookService` — `@Cacheable` on the list method, `@CacheEvict` on its four write methods.
- `AdditionalDepositService.deposit` and `UserService.deleteUser` — `@CacheEvict` for writes that mutate passbooks outside the passbook endpoints.

The split of responsibilities:

- **PostgreSQL** stays the source of truth; every write path goes to the DB first and only then evicts cache entries.
- **Redis** holds time-limited (10 min) copies of already-computed `PagedResponseDTO<SavingsPassbookDTO>` pages, keyed per user + page + size. Losing it costs nothing but a recomputation.

```
browser ──JWT──> frontend ──> backend :8082   GET /savings-passbooks?page=0&size=10
                                              │  JwtRequestFilter → requestSecurityContext.username
                                              ▼
                                   SavingsPassbookController
                                              │  call routed through the caching proxy
                                              ▼
                        cache interceptor — key "<username>:<page>:<size>"
                                              │
                                   Redis GET savings-passbooks::<email>:<page>:<size>
                                     ┌─ hit ──┴──── miss ──────────────────────────┐
                                     │        service method body runs:            │
                                return the    UserUtils.getCurrentUser()   (select) │
                                cached DTO    savingsPassbookRepo.findByUserId     │
                                (no SQL)      .map(toDTO) → PagedResponseDTO.from  │
                                     │        then PUT the DTO into Redis (TTL 10m)
                                     ▼                        ▼
                                   200 OK                   200 OK
```

## 1. Infrastructure (docker-compose.yml)

```yaml
redis:
  image: redis:7-alpine        # official library/redis image (still on Docker Hub)
  container_name: myassets-redis
  restart: always
  ports: ["6379:6379"]
  volumes: [redis_data:/data]
  healthcheck: ["CMD", "redis-cli", "ping"]
```

- **6379** is the only surface; unauthenticated, matching the dev posture of the exposed Postgres/MinIO credentials.
- Data persists in the `redis_data` named volume (default periodic RDB snapshots — harmless for a cache).
- **No bootstrap step**: unlike MinIO's bucket creation, nothing is created at startup. The cache starts empty and fills on demand; `docker compose up -d` alone is enough.

## 2. Application configuration

`pom.xml` adds two parent-managed starters: `spring-boot-starter-cache` (the annotation model) and `spring-boot-starter-data-redis` (Lettuce client + `spring.data.redis.*` support).

`application.properties`:

| Property | Value | Purpose |
|---|---|---|
| `spring.data.redis.host` / `port` | `localhost` / `6379` | Point at the compose service (explicit though they match defaults) |
| `spring.data.redis.timeout` | `2s` | Lettuce **command timeout** — caps how long any cache op may stall when Redis is unreachable |
| `spring.cache.type` | `redis` | Inert once the custom `CacheManager` bean exists (Boot's auto-config backs off via `@ConditionalOnMissingBean`); kept as documentation of the provider choice |

`@EnableCaching(order = 0)` on `AssetManagerApplication` does two things: enables the cache interceptors, and pins them **outermost** relative to `@Transactional` (which defaults to lowest precedence). Effect: `@CacheEvict` on a transactional writer fires *after* the DB commit, so a concurrent reader can't refill the cache with pre-commit data.

## 3. Cache configuration — `configuration/RedisCacheConfig`

The class name is deliberately `RedisCacheConfig`, not `RedisCacheConfiguration` — its body imports `org.springframework.data.redis.cache.RedisCacheConfiguration` (TTL/serializer builder), which would collide with the enclosing class's simple name.

**`RedisCacheManager` bean** — a single default cache config:

- `entryTtl(Duration.ofMinutes(10))` — every entry expires 10 minutes after write; TTL is the staleness bound if an eviction is ever missed (e.g. rows edited directly in the DB).
- `disableCachingNullValues()` — the list method never returns null; nothing null is stored.
- No per-cache overrides; the one cache name is `AssetConstants.CACHE_SAVINGS_PASSBOOKS` = `"savings-passbooks"`. With Boot's default prefixing the stored key is `savings-passbooks::<email>:<page>:<size>` (e.g. `savings-passbooks::alice@mail.com:0:10`).

**Serialization** — `GenericJackson2JsonRedisSerializer` over a purpose-built mapper:

1. Start from Boot's auto-configured `ObjectMapper` and **`.copy()` it** — activating default typing on the shared MVC mapper would corrupt every REST response.
2. `activateDefaultTyping(LaissezFaireSubTypeValidator, NON_FINAL, As.PROPERTY)` — embeds `@class` type hints on non-final types so the erased `PagedResponseDTO<SavingsPassbookDTO>` graph round-trips into real DTOs. This must be done *before* constructing the serializer; skipping it fails **silently** (deserialized values come back as `LinkedHashMap`, and generics erasure means the controller still serializes them out correctly).
3. `GenericJackson2JsonRedisSerializer.registerNullValueSerializer(mapper, null)` — the documented contract for external mappers (defensive; moot while null caching is disabled).

The copied mapper already carries JavaTimeModule and ISO-8601 date writing from Boot, so `LocalDateTime` and `BigDecimal` fields serialize as readable strings. The no-arg `new GenericJackson2JsonRedisSerializer()` is **not** usable here: in spring-data-redis 3.2 its internal mapper lacks JavaTimeModule.

**`CacheErrorHandler`** (via `CachingConfigurer.errorHandler()`, the only method overridden) — every cache op failure (get/put/evict/clear) becomes a single `log.warn` with the cache name, key, and exception message. The interceptor treats a failed GET as a miss and moves on; a failed PUT just means the value isn't cached. Redis outages never propagate to the HTTP response.

## 4. API flow

### Read — `GET /savings-passbooks?page&size` → `getMySavingsPassbooks(page, size)`

1. `JwtRequestFilter` validates the Bearer token and sets `username` on the request-scoped `requestSecurityContext` bean (it sets **no userId** — the JWT carries only username + role).
2. Controller calls the service **through the Spring proxy**, so the `@Cacheable` interceptor runs. Its SpEL key is `@requestSecurityContext.username + ':' + #page + ':' + #size` — resolved on the request thread, costing **zero DB queries** (the same identity the rate limiter keys on).
3. Redis `GET savings-passbooks::<email>:<page>:<size>`:
   - **Hit** → the method body is skipped entirely — including `UserUtils.getCurrentUser()`'s user-by-email select and the page query. Measured with `show-sql=true`: a miss runs 3 selects (JWT filter's `loadUserByUsername`, `getCurrentUser`, page query), a hit runs only the JWT filter's 1.
   - **Miss** → body executes: resolve user → `findByUserId` ordered by `COALESCE(maturityDate, withdrawalDate) DESC` → `.map(this::toDTO)` → `PagedResponseDTO.from(...)`; the DTO is PUT into Redis (TTL 10 min) and returned.
4. The controller wraps the DTO in `ResponseEntity.ok(...)` — the service returns the plain `PagedResponseDTO` (not a `ResponseEntity`) because `ResponseEntity` has no default creator and is not reliably Jackson-deserializable as a cache value. The HTTP response body is unchanged.

### Writes — eviction

Every write that can change what the list returns evicts **all entries** in the cache after the method completes successfully (`beforeInvocation = false` — a failed write leaves the cache alone):

| Service method | Triggering endpoint | Note |
|---|---|---|
| `SavingsPassbookService.createSavingsPassbook` | `POST /savings-passbooks` | also inserts the initial `AdditionalDeposit` |
| `SavingsPassbookService.updateSavingsPassbook` | `PUT /savings-passbooks/{id}` | |
| `SavingsPassbookService.deleteSavingsPassbook` | `DELETE /savings-passbooks/{id}` | |
| `SavingsPassbookService.deleteSavingsPassbooks` | `DELETE /savings-passbooks/bulk` | `@Transactional` — with `order = 0` the evict lands after commit |
| `AdditionalDepositService.deposit` | `POST /additional-deposits` | sender-identifies-themselves flow: the passbook **owner may differ from the caller**, and their username isn't derivable from the request context — hence `allEntries` instead of a per-user key |
| `UserService.deleteUser` | `DELETE /users/{id}` | user delete cascades their assets |

`allEntries = true` (a `SCAN`+`DEL` of `savings-passbooks::*`) is the right granularity for a personal app: per-page keys make targeted eviction impractical, and wiping every user's list entries on any write costs one recomputation each.

## 5. Failure behavior

Redis is deliberately a **soft** dependency, in contrast to MinIO's hard startup dependency:

- **App boots without Redis.** The `RedisCacheManager` connects lazily; nothing touches Redis until the first cached call. (MinIO's bucket bootstrap runs eagerly and fails the context.)
- **Requests survive an outage.** With Redis stopped, a GET pays the 2s command timeout on the failed cache read, runs against Postgres, then pays another 2s on the failed cache PUT — ~4s total, HTTP 200, with two `WARN` lines per request (`Redis GET failed ... falling through to DB`, `Redis PUT failed ...`). Writes behave the same (the evict's failure is logged and swallowed). The 2s timeout exists precisely because Lettuce's default is 60s per op.
- **Recovery is automatic.** Once Redis is reachable again, the next miss repopulates the key; stale entries from before the outage are bounded by the 10-minute TTL.

## 6. Caveats & non-obvious behavior

- **Only the paged list is cached.** `GET /savings-passbooks/search` and `GET /savings-passbooks/{id}` always hit Postgres — they were left out of scope deliberately.
- **Keys contain the user's email in cleartext** (`savings-passbooks::alice@mail.com:0:10`) — same sensitivity as the rate limiter's in-memory `user:<email>` keys.
- **`LaissezFaireSubTypeValidator`** allows any subtype on cache deserialization. Safe only because the cache is writable solely by this app on localhost; an attacker who could write to Redis could craft gadget payloads.
- **`UserService.deleteUser`'s evict is currently unreachable in practice**: the endpoint itself fails with a `refresh_tokens` FK violation for any user who still has token rows (pre-existing bug, unrelated to Redis) — change-password first to revoke tokens, then delete succeeds.
- **Direct DB edits bypass eviction** — rows changed outside the app (SQL console) stay stale in the cache until the 10-minute TTL expires.
- The Redis mapper writes `content` as `java.util.Collections$UnmodifiableRandomAccessList` (`Page.map` yields an immutable list) — an artifact of default typing, harmless on round-trip.

## Quick manual check

```bash
docker compose up -d                                  # myassets-redis healthy; redis-cli ping -> PONG
mvn spring-boot:run                                   # boots even with Redis empty/stopped
TOKEN=$(curl -s -X POST localhost:8082/auth/login -H 'Content-Type: application/json' \
       -d '{"email":"...","password":"..."}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
curl -s "localhost:8082/savings-passbooks?page=0&size=10" -H "Authorization: Bearer $TOKEN"   # miss: SQL logged
sleep 1
curl -s "localhost:8082/savings-passbooks?page=0&size=10" -H "Authorization: Bearer $TOKEN"   # hit: no SQL
docker exec myassets-redis redis-cli KEYS 'savings-passbooks::*'                              # the key
docker exec myassets-redis redis-cli TTL 'savings-passbooks::<email>:0:10'                    # <= 600
curl -s -X POST localhost:8082/savings-passbooks -H "Authorization: Bearer $TOKEN" \
     -H 'Content-Type: application/json' -d '{"principalAmount":1000,"interestRate":5.5,"maturityDate":"2027-01-01T00:00:00"}'
docker exec myassets-redis redis-cli KEYS 'savings-passbooks::*'                              # empty — evicted
docker compose stop redis                              # GETs still 200 from the DB (~4s, WARN logs)
```

(Mind the 3 req/s rate limiter — keep ~0.5s between calls.)
