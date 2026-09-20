---
paths:
  - "src/app/store/notification-store*"
---

# Notifications

- WebSocket `ws://localhost:8082/ws/notifications?token=<access>` (token in the query string because the WS API can't set headers; URL derived from apiUrl).
- Subscribes to auth session transitions to connect/disconnect; exponential backoff capped at 30s; recycles zombie sockets on wake via `visibilitychange`/`online`.
- List + badge persist to localStorage (see `local-storage.md`).
