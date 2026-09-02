---
description: JPA domain model — Asset JOINED inheritance, per-type asset entities, User/AccountLevel relations, and role enum conventions
globs:
  - "src/main/java/**/models/**"
  - "src/main/java/**/repo/**"
  - "src/main/java/**/dto/**"
  - "src/main/java/**/wrapper/**"
alwaysApply: false
---

# Domain Model

`models/Asset` is an abstract entity using JOINED inheritance — one shared `assets` table (id, user_id, asset_type discriminator, created_at) plus per-type tables. `Asset` carries the `AssetType` enum (SAVINGS_PASSBOOK, LAND, CASH, OTHER) and a non-nullable `@ManyToOne user`:

- `SavingsPassbook` (principal, interest rate, maturity, generated passbook number) with child `AdditionalDeposit` rows (`@ManyToOne` back to the passbook)
- `CashAsset` with child `CashBalance` rows, each referencing a `Currency` — unique constraint on `(cashAsset_id, currency_code)`
- `LandAsset`, `OtherAsset`

`Currency` is reference data whose `@Id` is the 3-char currency code (String), not a generated Long.

`User` owns assets (cascade ALL, orphanRemoval) and has a required `ManyToOne` to `AccountLevel`, plus a unique `accountNumber`.

Roles: `ROLE_USER`, `ROLE_ADMIN`, `ROLE_CUSTOMER` (enum values include the `ROLE_` prefix).