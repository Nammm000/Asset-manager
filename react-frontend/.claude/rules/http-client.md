---
paths:
  - "src/app/core/**"
---

# HTTP client layer

Two steps, strictly layered:

- `core/http.ts` `rawRequest` — fetch with Angular-HttpClient semantics (query `params`, `responseType json|text|blob`, `credentials: 'include'` on `/auth/*`, failures normalized to `ApiError`).
- `core/api-client.ts` `apiRequest` — phase-ordered (refresh bypass → Bearer attach + one-shot 401 retry → proactive single-flight refresh → anonymous).

The dependency is one-way: api-client → auth-store; **auth-store must never import api-client**. Auth/session semantics (single-flight refresh, memory-only token) are in `auth.md`.
