---
paths:
  - "src/app/service/**"
---

# Services

- Exported async functions over `apiRequest`, no classes.
- Angular's `delete` is renamed **`remove`** (reserved word); bulk delete is `deleteMany(ids)` → `DELETE /<resource>/bulk`.
- `user-image.ts` (the one file without the `.service` suffix) fetches the JWT-protected avatar as a Blob and publishes a `blob:` object URL into auth-store — never a plain `<img src>`.

Backend response quirks these consume are in `backend-contract.md`.
