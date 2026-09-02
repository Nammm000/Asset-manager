---
description: Asset service business rules — savings passbook deposits, cash asset/balance creation and add-or-subtract, and ownership checks
globs:
  - "src/main/java/**/services/asset/**"
  - "src/main/java/**/models/**"
alwaysApply: false
---

# Asset Business Rules

Non-obvious service behavior (services under `services/asset/`):

- **SavingsPassbook create** (`SavingsPassbookService.createSavingsPassbook`, `@Transactional`): auto-generates the passbook number and auto-creates the initial `AdditionalDeposit` row for the principal amount, linked to the new passbook.
- **Additional deposit** (`AdditionalDepositService.deposit`, `@Transactional`): `POST /additional-deposits` body (`AdditionalDepositRequestDTO`) identifies the user by `accountNumber` plus a matching `email` or `phone` — there is no JWT-current-user lookup here, it's a sender-identifies-themselves flow. The deposit amount is added to the passbook's `principalAmount` and a linked `AdditionalDeposit` row is recorded; the updated `SavingsPassbookDTO` is returned.
- **Cash assets / balances** (`CashAssetService`, `CashBalanceService`): a user may own multiple `CashAsset`s. `POST /cash-assets` creates a fresh asset from `name` (required) + `description` only — the old singleton get-or-create and per-currency balance upsert are commented out in `CashAssetService` (along with the former `addCashAsset`). Balances are managed via `/cash-balances`: `POST` always inserts a new row (the duplicate pre-check is commented out; duplicates are rejected by the `uq_cash_asset_currency` DB constraint), and `POST /cash-balances/{id}` (`addOrSubtractCashBalance`, `@Transactional`) adds the request amount to the existing balance — negative amounts subtract — after verifying the requested `currencyCode` matches the balance's currency (else `IllegalArgumentException` "Wrong Currency Code." → 400). **Caution:** `addOrSubtractCashBalance` resolves the balance by id but does not call `UserUtils.checkOwnership`, unlike every other by-id operation.
- **Ownership**: every by-id read/update/delete resolves the asset then calls `UserUtils.checkOwnership(asset)`, which throws `AccessDeniedException` (→ 403) when the asset belongs to another user. Exception: `addOrSubtractCashBalance` (see above).
- Repos favor derived queries: `findByUserId`, `findByCashAssetUserId`, `existsByCashAssetIdAndCurrencyCode`, etc. (see `repo/`).
