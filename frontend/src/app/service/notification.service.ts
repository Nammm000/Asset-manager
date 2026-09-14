import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Notification } from 'model/notification.model';
import { AuthService } from 'service/auth.service';

/**
 * Receives the backend's periodic WebSocket broadcasts on /ws/notifications and
 * exposes them as signals for the header bell. Browser-only by design: on the
 * server (SSR) the service is an inert signal holder — every socket touch is
 * guarded with isPlatformBrowser.
 *
 * Auth: the browser WebSocket API cannot set headers, so the handshake carries
 * the in-memory access token as a ?token= query param (validated server-side by
 * the handshake interceptor). Handshake auth is one-time — an open connection
 * outlives the 15-min token; expiry only matters at reconnect time.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  /** Newest-first history cap; also clamps the unread badge. */
  private static readonly MAX_HISTORY = 20;
  private static readonly MAX_BACKOFF_MS = 30_000;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly authService = inject(AuthService);

  private readonly _notifications = signal<Notification[]>([]);
  /** Newest first. */
  readonly notifications = this._notifications.asReadonly();

  private readonly _unreadCount = signal(0);
  readonly unreadCount = this._unreadCount.asReadonly();

  private readonly _connected = signal(false);
  readonly connected = this._connected.asReadonly();

  /** Derived from apiUrl (http→ws) so the API host is configured in one place. */
  private readonly wsUrl = `${environment.apiUrl.replace(/^http/, 'ws')}/ws/notifications`;

  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;

  constructor() {
    // Owns the connection lifecycle: a session appearing opens the socket (the
    // effect re-runs when login/signup/refresh installs a token), a session
    // ending closes it and resets the bell for the next session.
    effect(() => {
      const active = this.authService.sessionActive();
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }
      if (active) {
        this.connect();
      } else {
        this.disconnect(true);
      }
    });
  }

  /** Opening the dropdown clears the badge; the list itself is kept. */
  markAllRead(): void {
    this._unreadCount.set(0);
  }

  /** "Clear all" — empties the list and the badge. */
  clearAll(): void {
    this._notifications.set([]);
    this._unreadCount.set(0);
  }

  /** Idempotent: one socket at a time; no-op until a token is available. */
  private connect(): void {
    if (!isPlatformBrowser(this.platformId) || this.socket !== null) {
      return;
    }
    const token = this.authService.token();
    if (token === null) {
      return;
    }

    const socket = new WebSocket(`${this.wsUrl}?token=${encodeURIComponent(token)}`);
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) {
        return; // a newer socket (or a disconnect) replaced this one
      }
      this._connected.set(true);
      this.reconnectAttempt = 0;
    };

    socket.onmessage = (event: MessageEvent) => this.handleMessage(event.data);

    socket.onclose = () => {
      if (this.socket !== socket) {
        return; // deliberate disconnect already cleaned up
      }
      this._connected.set(false);
      this.socket = null;
      this.scheduleReconnect();
    };
  }

  private disconnect(reset: boolean): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = 0;
    if (this.socket !== null) {
      const socket = this.socket;
      // Detach first so the socket's onclose sees it is no longer current and
      // skips the reconnect scheduling.
      this.socket = null;
      socket.close();
    }
    this._connected.set(false);
    if (reset) {
      // A fresh session starts with a fresh bell.
      this._notifications.set([]);
      this._unreadCount.set(0);
    }
  }

  /**
   * Exponential backoff (capped) while the tab still believes a session exists;
   * logout/expiry (sessionActive false) leaves the socket closed for good.
   */
  private scheduleReconnect(): void {
    if (!isPlatformBrowser(this.platformId) || !this.authService.sessionActive()) {
      return;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, NotificationService.MAX_BACKOFF_MS);
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      void this.reconnect();
    }, delay);
  }

  /**
   * The 15-min access token may have expired while the socket was down — refresh
   * first so the handshake query param carries a live token. A failed refresh
   * means the session is dead: hand off to sessionExpired() (the HTTP
   * interceptor's automatic handling does not apply to service-initiated calls).
   */
  private async reconnect(): Promise<void> {
    if (!this.authService.sessionActive()) {
      return;
    }
    if (!this.authService.hasLiveAccessToken()) {
      try {
        await firstValueFrom(this.authService.refreshSession());
      } catch {
        this.authService.sessionExpired();
        return;
      }
    }
    this.connect();
  }

  private handleMessage(data: unknown): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof data === 'string' ? data : '');
    } catch {
      return; // malformed frame — ignore rather than break the bell
    }
    if (!this.isNotification(parsed)) {
      return;
    }
    this._notifications.update((list) => [parsed, ...list].slice(0, NotificationService.MAX_HISTORY));
    this._unreadCount.update((count) => Math.min(count + 1, NotificationService.MAX_HISTORY));
  }

  /** Shape + parseable-timestamp guard for anything arriving off the socket. */
  private isNotification(value: unknown): value is Notification {
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
}
