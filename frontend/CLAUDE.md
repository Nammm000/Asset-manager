# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Angular 21 frontend (standalone components, signals, SSR via Express) for a personal asset management app, paired with the Spring Boot backend in `../backend`. Auth (JWT login/signup/logout/change-password via modals) is live; asset UI pages exist only as unrouted stub components — their service/model layer is complete.

Detailed guidance is split into topic-specific rule files in `.claude/rules/`:

- `project-overview.md` — project identity, backend pairing, git status
- `commands.md` — dev/build/test commands, single-test invocation, tooling gaps
- `architecture.md` — signals state, auth session/interceptor/guard chain, modal pattern, HTTP service layer, forms
- `backend-api.md` — REST/JWT contract with the backend, endpoint map per service, `PagedResponseDTO`, error body shapes
- `conventions.md` — bare-specifier imports, naming, service/model patterns, SCSS split and budgets, locales, strict TS
