import { create } from 'zustand';
import { environment } from '../../environments/environment';
import { Notification } from 'model/notification.model';
import { useAuthStore } from 'store/auth-store';

/** Shape persisted to localStorage so the bell survives page reloads / tab discards (e.g. laptop sleep). */
interface StoredNotifications {
  notifications: Notification[];
  unreadCount: number;
}

interface NotificationState {
  /** Newest first. */
  notifications: Notification[];
  unreadCount: number;
  connected: boolean;
  markAllRead(): void;
  clearAll(): void;
}

/** Newest-first history cap; also clamps the unread badge. */
const MAX_HISTORY = 20;
const MAX_BACKOFF_MS = 30_000;
/** A socket still OPEN after being hidden this long is assumed dead (sleep zombie) and recycled. */
const RECYCLE_AFTER_HIDDEN_MS = 60_000;
const STORAGE_KEY = 'asset-manager.notifications';

/** Derived from apiUrl (http→ws) so the API host is configured in one place. */
const wsUrl = `${environment.apiUrl.replace(/^http/, 'ws')}/ws/notifications`;

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  connected: false,

  /** Opening the dropdown clears the badge; the list itself is kept. */
  markAllRead: () => {
    set({ unreadCount: 0 });
    persist(get());
  },

  /** "Clear all" — empties the list and the badge. */
  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
    clearStorage();
  },
}));

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
/** When the page was last hidden; drives the recycle-after-long-hide check on wake. */
let hiddenAt: number | null = null;

/**
 * Receives the backend's periodic WebSocket broadcasts on /ws/notifications and
 * exposes them for the header bell.
 *
 * Auth: the browser WebSocket API cannot set headers, so the handshake carries
 * the in-memory access token as a ?token= query param (validated server-side by
 * the handshake interceptor). Handshake auth is one-time — an open connection
 * outlives the 15-min token; expiry only matters at reconnect time.
 *
 * Sleep/wake resilience: the list + unread count persist to localStorage
 * (Chrome discards background tabs during sleep and reloads them on wake — the
 * session is silently restored, but memory-only state would be gone), network
 * errors during a reconnect refresh retry with backoff instead of killing the
 * session, and visibilitychange/online listeners reconnect immediately after a
 * wake instead of waiting out the backoff timer or a dead socket's TCP timeout.
 *
 * The Angular service owned this lifecycle via a constructor effect() and
 * isPlatformBrowser guards; here it is owned by initNotificationSync(), called
 * once from main.tsx BEFORE first render (outside React, so StrictMode cannot
 * double-connect) — mirroring provideAppInitializer's settled-state guarantee.
 */
let initialized = false;

export function initNotificationSync(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  restoreFromStorage();

  // Owns the connection lifecycle: a session appearing opens the socket (the
  // listener fires on login/signup/refresh installing a session), a session
  // ending closes it and resets the bell for the next session. The initial
  // check reproduces the Angular effect's first run (guest → bell reset).
  let wasActive = useAuthStore.getState().sessionActive;
  useAuthStore.subscribe((state) => {
    if (state.sessionActive === wasActive) {
      return;
    }
    wasActive = state.sessionActive;
    if (state.sessionActive) {
      connect();
    } else {
      disconnect(true);
    }
  });
  if (wasActive) {
    connect();
  } else {
    disconnect(true);
  }

  // Wake watchers: after laptop sleep the socket is usually dead, the network
  // may lag the page, and any pending backoff timer is stale.
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('online', onOnline);
}

/** Idempotent: one socket at a time; no-op until a token is available. */
function connect(): void {
  if (socket !== null) {
    return;
  }
  const token = useAuthStore.getState().token;
  if (token === null) {
    return;
  }

  const current = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
  socket = current;

  current.onopen = () => {
    if (socket !== current) {
      return; // a newer socket (or a disconnect) replaced this one
    }
    useNotificationStore.setState({ connected: true });
    reconnectAttempt = 0;
  };

  current.onmessage = (event: MessageEvent) => handleMessage(event.data);

  current.onclose = () => {
    if (socket !== current) {
      return; // deliberate disconnect already cleaned up
    }
    useNotificationStore.setState({ connected: false });
    socket = null;
    scheduleReconnect();
  };
}

function disconnect(reset: boolean): void {
  cancelReconnectTimer();
  reconnectAttempt = 0;
  if (socket !== null) {
    const current = socket;
    // Detach first so the socket's onclose sees it is no longer current and
    // skips the reconnect scheduling.
    socket = null;
    current.close();
  }
  useNotificationStore.setState({ connected: false });
  if (reset) {
    // A fresh session starts with a fresh bell.
    useNotificationStore.setState({ notifications: [], unreadCount: 0 });
    clearStorage();
  }
}

/**
 * Exponential backoff (capped) while the tab still believes a session exists;
 * logout/expiry (sessionActive false) leaves the socket closed for good.
 */
function scheduleReconnect(): void {
  if (!useAuthStore.getState().sessionActive) {
    return;
  }
  const delay = Math.min(1000 * 2 ** reconnectAttempt, MAX_BACKOFF_MS);
  reconnectAttempt++;
  reconnectTimer = setTimeout(() => {
    void reconnect();
  }, delay);
}

function cancelReconnectTimer(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

/**
 * The 15-min access token may have expired while the socket was down — refresh
 * first so the handshake query param carries a live token. A refresh rejection
 * with a real HTTP status (401) means the session is dead: hand off to
 * sessionExpired() (the api-client's automatic handling does not apply to
 * service-initiated calls). A status-0 network error (e.g. the network stack
 * not being back yet after a wake) is transient: retry via backoff instead of
 * logging the user out and wiping the bell.
 */
async function reconnect(): Promise<void> {
  const auth = useAuthStore.getState();
  if (!auth.sessionActive) {
    return;
  }
  if (!auth.hasLiveAccessToken()) {
    try {
      await auth.refreshSession();
    } catch (error) {
      if (isNetworkError(error)) {
        scheduleReconnect();
      } else {
        auth.sessionExpired();
      }
      return;
    }
  }
  connect();
}

/**
 * The page became visible again or the network came back. Don't sit out a
 * pending backoff timer, and recycle a socket that sat OPEN through a long
 * hide — after a laptop sleep it is almost certainly a zombie whose onclose
 * the browser hasn't noticed. Short hides (alt-tab) leave a healthy socket.
 */
function onWake(): void {
  if (!useAuthStore.getState().sessionActive) {
    return;
  }
  const hiddenFor = hiddenAt === null ? 0 : Date.now() - hiddenAt;
  hiddenAt = null;

  const current = socket;
  if (current !== null) {
    if (current.readyState === WebSocket.OPEN) {
      if (hiddenFor < RECYCLE_AFTER_HIDDEN_MS) {
        return; // healthy connection, nothing to do
      }
    } else if (current.readyState === WebSocket.CONNECTING) {
      return; // handshake in flight — let it settle
    }
    // OPEN-after-long-hide (zombie) or CLOSING/CLOSED: recycle and go again.
    socket = null; // detach first so onclose skips its scheduling
    current.close();
  }
  cancelReconnectTimer();
  reconnectAttempt = 0;
  void reconnect();
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
  } else {
    onWake();
  }
}

function onOnline(): void {
  onWake();
}

function handleMessage(data: unknown): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof data === 'string' ? data : '');
  } catch {
    return; // malformed frame — ignore rather than break the bell
  }
  if (!isNotification(parsed)) {
    return;
  }
  const state = useNotificationStore.getState();
  useNotificationStore.setState({
    notifications: [parsed, ...state.notifications].slice(0, MAX_HISTORY),
    unreadCount: Math.min(state.unreadCount + 1, MAX_HISTORY),
  });
  persist(useNotificationStore.getState());
}

/** Shape + parseable-timestamp guard for anything arriving off the socket or out of storage. */
function isNotification(value: unknown): value is Notification {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['message'] === 'string' &&
    typeof candidate['timestamp'] === 'string' &&
    !Number.isNaN(Date.parse(candidate['timestamp']))
  );
}

/** ApiError with status 0 — the browser couldn't reach the server at all. */
function isNetworkError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as Record<string, unknown>)['status'] === 0;
}

export function restoreFromStorage(): void {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return; // storage unavailable (private mode etc.) — start empty
  }
  if (raw === null) {
    return;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return;
    }
    const candidate = parsed as Record<string, unknown>;
    const list = Array.isArray(candidate['notifications'])
      ? candidate['notifications'].filter((item) => isNotification(item)).slice(0, MAX_HISTORY)
      : [];
    const unreadRaw = candidate['unreadCount'];
    const unreadCount =
      typeof unreadRaw === 'number' && Number.isFinite(unreadRaw)
        ? Math.min(Math.max(Math.trunc(unreadRaw), 0), MAX_HISTORY)
        : 0;
    useNotificationStore.setState({ notifications: list, unreadCount });
  } catch {
    // corrupt storage — start with an empty bell rather than crash
  }
}

function persist(state: NotificationState): void {
  const snapshot: StoredNotifications = {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // storage full/unavailable — in-memory state stays authoritative
  }
}

function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to do — storage already unavailable
  }
}
