# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Spring Boot 3.2.3 / Java 17 backend for a personal asset management app (package `tech.getarrays.assetmanager`).

Detailed guidance is split into topic-specific rule files in `.claude/rules/`:

- `project-overview.md` — project identity, legacy `CinemaManager` naming, Angular frontend
- `commands.md` — Docker/Maven commands and the JDK 17 requirement
- `architecture.md` — layered structure and cross-cutting components
- `api-surface.md` — endpoint map per controller and REST conventions
- `security-auth.md` — stateless JWT auth, filter chain, roles
- `domain-model.md` — Asset JOINED inheritance, User/AccountLevel, role enum
- `asset-business-rules.md` — savings deposit, cash asset/balance rules, and ownership rules
- `exception-handling.md` — AllExceptionHandler status mapping and ErrorResponseDTO
- `database-schema.md` — Postgres setup and `ddl-auto=update` behavior
- `code-generation.md` — Lombok/MapStruct wiring and conventions
- `signup-defaults.md` — default BASIC AccountLevel and `ACC-<uuid>` account number on signup
- `email-credentials.md` — Gmail SMTP credentials location