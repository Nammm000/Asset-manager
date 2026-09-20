---
paths:
  - "src/app/component/**"
  - "src/app/app.tsx"
  - "src/app/store/modal-store.ts"
---

# Modals & forms

## Modals

- The four modals (Login, Signup, ChangePassword, Confirmation) are **permanently mounted in `app.tsx`**; visibility is store flags, never component-to-component.
- `openConfirmation({ title, message, onConfirm, danger })` — the request object doubles as the visibility state.

## Forms

- Controlled inputs with **derived validation** — an error shows when the value is non-empty AND invalid; there is no touched/pristine.
- Submit handlers call `event.preventDefault()` explicitly.
