# TypeScript & naming conventions

- **Bare imports** (`store/…`, `service/…`, `model/…`, `component/…`, `core/…`, `hooks/…`, `guard/…`, `util/…`, `i18n/…`) resolve through BOTH `tsconfig.app.json` paths AND the regex aliases in `vite.config.ts` — a new top-level dir under `src/app/` must be added to both. `environments/` is imported relatively.
- Naming: `*.service.ts`; `*.model.ts` mirrors backend DTOs exactly (quirks documented in doc comments); specs colocated as `*.spec.ts(x)`; named function components, no default exports.
- TypeScript is strict, incl. `noPropertyAccessFromIndexSignature` (hence `record['key']` access in places). No ESLint/Prettier — `npm run build` is the only static check.
