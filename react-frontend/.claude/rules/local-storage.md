---
paths:
  - "src/app/store/**"
  - "index.html"
---

# localStorage keys

| Key | Written by |
| --- | --- |
| `asset-manager.theme` | theme-store (also read by the index.html pre-paint script) |
| `asset-manager.language` | language-store |
| `asset-manager.notifications` | notification-store (list + badge) |
| `asset-manager.avatar` | auth-store (http(s) URLs only, never `blob:`) |

Legacy `asset-manager.token` / `asset-manager.refreshToken` are purged at startup by auth-store module init — never write them.
