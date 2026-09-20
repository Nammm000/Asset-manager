# Commands

npm scripts, the mandatory dev port, runtime config, and the full-stack (backend + infra) commands.

```bash
npm install
npm run dev         # Vite dev server — MUST stay on port 4200 (strictPort in vite.config.ts)
npm test            # Vitest + React Testing Library (jsdom), single run
npm run test:watch  # Vitest watch mode
npx vitest run src/app/store/auth-store.spec.ts  # single spec file
npm run build       # tsc -b && vite build → dist/  (the ONLY typecheck — there is no lint)
npm run preview     # serves dist/ from another origin — credentialed backend requests FAIL
```

- **Port 4200 is mandatory**: the backend's CORS allowlist and WebSocket allowed-origins read `app.client.url=http://localhost:4200` (in `../backend/src/main/resources/application.properties`). Dev against the backend means `npm run dev`, never `vite preview`.
- Runtime config is `src/environments/environment.ts` (`apiUrl: "http://localhost:8082"`) — a plain TS file; there are no env vars.

## Full stack (backend + infra)

```bash
cd ../backend && docker compose up -d   # postgres:16 → localhost:5433, MinIO (quay.io) → 9000 API / 9001 console
export JAVA_HOME=/Users/namnlh/Library/Java/JavaVirtualMachines/ms-17.0.18/Contents/Home  # JDK 17 — Lombok fails on the default JDK 25
cd ../backend && mvn spring-boot:run    # serves http://localhost:8082
```
