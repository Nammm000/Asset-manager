---
description: Code conventions — bare-specifier imports, Angular 20+ file naming, service/model patterns, SCSS split and budgets, Vietnamese locale formatting, strict TypeScript
globs:
  - "src/**/*.ts"
  - "src/**/*.scss"
  - "tsconfig.json"
alwaysApply: false
---

# Conventions

- **Imports use bare specifiers**, not relative paths: tsconfig maps `"*": ["src/app/*"]`, so `import { validateEmail } from 'util/auth-util'` and `import { ModalService } from 'service/modal.service'` resolve inside `src/app/`. Exceptions: `src/environments/` is outside the mapping, so services import it relatively (`'../../environments/environment'`); and `util/auth-util.ts` imports `component/shared/global-constants.ts` relatively (`'./../component/shared/global-constants'`) — `'component/shared/global-constants'` would resolve fine, so treat that as legacy, not a pattern to copy.
- **Shared constants**: `component/shared/global-constants.ts` holds `GlobalMessages` (user-facing error/success strings), `GlobalRegexes` (email/phone/name), and `GlobalConstants` (`'error'`/`'success'` status keys). `util/auth-util.ts` wraps the regexes for form validation.
- **Naming**: Angular 20+ style guide — class `Login` in `login.ts` / `login.html` / `login.scss` (no `.component` suffix anywhere). Services keep the `.service.ts` suffix; models are plain `*.model.ts` interfaces/types.
- **Services**: `@Injectable({ providedIn: 'root' })`, `inject()` over constructor injection in services (components use constructor DI), `readonly` for injected fields and `baseUrl`. Models mirror backend DTO field names exactly, quirks documented in doc comments rather than papered over.
- **Styling**: SCSS. Shared modal chrome (backdrop, container) is global in `src/scss/modal.scss`, imported from `src/styles.scss`; per-component styles stay in the component's `.scss`. Production budgets: errors at 1MB initial bundle / 8kB per component style (warnings at 500kB / 4kB).
- **Locales**: `util/time-util.ts` formats dates in Vietnamese (weekday/month names) and groups numbers with dots (`de-DE`); UI copy is English.
- TypeScript is strict, including `strictTemplates`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch`, and `noImplicitOverride` (relaxed to `false` in `tsconfig.app.json`) — see `tsconfig.json`.
