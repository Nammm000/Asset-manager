---
paths:
  - "src/**/*.scss"
  - "index.html"
  - "src/app/store/theme-store*"
---

# Theming & styling

## Theme

- `data-theme` on `<html>`, follows the OS preference live until the first explicit toggle.
- THREE places share the convention and must be kept in sync manually: the pre-paint inline script in `index.html`, `theme-store.ts`, `src/scss/theme.scss` (key `asset-manager.theme`).

## Styling

- Plain SCSS, class names unchanged from Angular.
- Raw colors live ONLY in `src/scss/theme.scss` custom properties (`:root` + `:root[data-theme='dark']`); everything else consumes tokens.
- Per-component `.scss` files are intentionally tiny — most page styling is global.
