---
paths:
  - "src/app/routes.tsx"
  - "src/app/guard/**"
  - "src/app/hooks/use-page-title.ts"
---

# Routing & guards

- Every page is `lazy(() => import(...))`; protected routes wrapped in `guard/RequireAuth.tsx` / `guard/RequireAdmin.tsx`.
- Guard denial renders null and opens the login modal — **there is no /login route**.
- Page titles via `hooks/use-page-title.ts`.
