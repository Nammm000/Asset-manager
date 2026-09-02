---
description: PostgreSQL setup and schema management — ddl-auto=update behavior and manual schema fixes
globs:
  - "src/main/resources/application*.properties"
  - "docker-compose*.yml"
  - "src/main/java/**/models/**"
alwaysApply: false
---

# Database & Schema Management

- Postgres 16 runs via `docker compose up -d` (db: `myassets`, user: `myuser`/`mypassword`, port 5432).
- `spring.jpa.hibernate.ddl-auto=update` — there are no migrations; Hibernate mutates the schema from entity mappings on startup.
- Adding columns works; changing constraints on existing columns does not. Deviating DB state is fixed manually.