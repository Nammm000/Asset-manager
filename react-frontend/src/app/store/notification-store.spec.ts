import { vi } from 'vitest';
import { environment } from '../../environments/environment';
import { flushPromises, jsonResponse, makeToken } from '../../test/helpers';
import type { Notification } from 'model/notification.model';
import type { useNotificationStore as NotificationStore } from 'store/notification-store';
import type { useAuthStore as AuthStore } from 'store/auth-store';

const STORAGE_KEY = 'asset-manager.notifications';
const WS_URL = `${environment.apiUrl.replace(/^http/, 'ws')}/ws/notifications`;

// Ported from notification.service.spec.ts: a fake WebSocket captures instances
// so tests can drive onopen/onmessage/onclose manually, and fake timers drive
// the exponential backoff.
class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  url: string;
  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  // Test drivers
  simulateOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }
  simulateMessage(data: string): void {
    this.onmessage?.({ data });
  }
}

let notificationStore: typeof NotificationStore;
let authStore: typeof AuthStore;
let fetchMock: ReturnType<typeof vi.fn>;

async function importFresh(): Promise<void> {
  vi.resetModules();
  ({ useNotificationStore: notificationStore } = await import('store/notification-store'));
  ({ useAuthStore: authStore } = await import('store/auth-store'));
  FakeWebSocket.instances = [];
}

async function setup(active = true): Promise<void> {
  await importFresh();
  if (active) {
    authStore.getState().applyAuthenticationResponse({ accessToken: makeToken() });
  }
}

function store(): ReturnType<typeof notificationStore.getState> {
  return notificationStore.getState();
}

function notification(message = 'hello', timestamp = '2026-09-20T10:00:00Z'): Notification {
  return { message, timestamp };
}

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe('notification store (persistence)', () => {
  it('restores a valid snapshot from localStorage, shape-checked and clamped', async () => {
    const valid = Array.from({ length: 30 }, (_, i) => notification(`m${i}`));
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ notifications: [...valid, { message: 'bad' }], unreadCount: 99 }),
    );
    await setup(false);

    const { restoreFromStorage } = await import('store/notification-store');
    restoreFromStorage();

    // Newest-first cap at 20, invalid items dropped, unread clamped to 20.
    expect(store().notifications).toHaveLength(20);
    expect(store().unreadCount).toBe(20);
  });

  it('starts empty on corrupt storage instead of crashing', async () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    await setup(false);

    const { restoreFromStorage } = await import('store/notification-store');
    expect(() => restoreFromStorage()).not.toThrow();
    expect(store().notifications).toEqual([]);
  });

  it('markAllRead clears the badge but keeps the list; clearAll empties both', async () => {
    await setup(false);
    const { restoreFromStorage } = await import('store/notification-store');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ notifications: [notification()], unreadCount: 1 }));
    restoreFromStorage();

    store().markAllRead();
    expect(store().unreadCount).toBe(0);
    expect(store().notifications).toHaveLength(1);

    store().clearAll();
    expect(store().notifications).toEqual([]);
    expect(store().unreadCount).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('notification store (WebSocket lifecycle)', () => {
  it('connects with the access token as a query param when a session is active', async () => {
    const token = makeToken();
    await setup();
    const { initNotificationSync } = await import('store/notification-store');
    initNotificationSync();

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0]!.url).toBe(`${WS_URL}?token=${encodeURIComponent(token)}`);
  });

  it('ignores malformed frames and stores valid ones newest-first, bumping the badge', async () => {
    await setup();
    const { initNotificationSync } = await import('store/notification-store');
    initNotificationSync();
    const socket = FakeWebSocket.instances[0]!;

    socket.simulateOpen();
    expect(store().connected).toBe(true);

    socket.simulateMessage('not json');
    socket.simulateMessage(JSON.stringify({ message: 'no timestamp' }));
    expect(store().notifications).toEqual([]);

    socket.simulateMessage(JSON.stringify(notification('first')));
    socket.simulateMessage(JSON.stringify(notification('second')));
    expect(store().notifications.map((n) => n.message)).toEqual(['second', 'first']);
    expect(store().unreadCount).toBe(2);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).unreadCount).toBe(2);
  });

  it('reconnects with backoff on close while the session is active', async () => {
    vi.useFakeTimers();
    await setup();
    const { initNotificationSync } = await import('store/notification-store');
    initNotificationSync();
    const first = FakeWebSocket.instances[0]!;
    first.simulateOpen();

    first.readyState = FakeWebSocket.CLOSED; // the browser closed it
    first.onclose?.();

    expect(store().connected).toBe(false);
    await vi.advanceTimersByTimeAsync(1000); // first backoff slot
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('reconnects anonymously-cleanly: a session end closes the socket and resets the bell', async () => {
    await setup();
    const { initNotificationSync } = await import('store/notification-store');
    initNotificationSync();
    const socket = FakeWebSocket.instances[0]!;
    socket.simulateMessage(JSON.stringify(notification('stored')));

    authStore.getState().clearSession(); // logout / expiry
    await flushPromises();

    expect(FakeWebSocket.instances[0]!.readyState).toBe(FakeWebSocket.CLOSED);
    expect(store().notifications).toEqual([]);
    expect(store().unreadCount).toBe(0);
  });
});
