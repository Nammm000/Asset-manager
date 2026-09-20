import { useAuthStore } from 'store/auth-store';
import { ApiError, RawRequestInit, rawRequest } from 'core/http';

/**
 * Ported from Angular's authInterceptor, phase-ordered. Used by every
 * non-auth service call; /auth/* calls live in auth-store via rawRequest
 * (with credentials: 'include'), so this client never needs to attach
 * cookies — the Path=/auth cookie would not flow on other URLs anyway.
 * One-way dependency on auth-store (which never imports this module).
 */

const AUTH_BASE = '/auth/';

function send<T>(path: string, init: RawRequestInit, token?: string | null): Promise<T> {
  return rawRequest<T>(path, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

export async function apiRequest<T>(path: string, init: RawRequestInit = {}): Promise<T> {
  const auth = useAuthStore.getState();
  const isAuthUrl = path.startsWith(AUTH_BASE);

  // (0) /auth/refresh bypasses everything: proactively refreshing it would
  // recurse, and rotation makes a second call replay a just-deleted token.
  // (Refresh itself never routes through here — this is a safety guard.)
  if (path === `${AUTH_BASE}refresh`) {
    return send<T>(path, init);
  }

  const { token } = auth;
  if (token !== null && auth.hasLiveAccessToken()) {
    // (1) Live token → attach (public endpoints ignore a valid header).
    //     Reactive safety net: a 401 (clock skew, revoked-mid-flight token)
    //     triggers one refresh + retry for non-/auth URLs. The retry is
    //     structural — it flows through send() only — so a 401 on the retry,
    //     like a failed refresh, lands in the same catch: sessionExpired() +
    //     rethrow of the ORIGINAL error (exactly one refresh+retry).
    try {
      return await send<T>(path, init, token);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && !isAuthUrl) {
        try {
          await useAuthStore.getState().refreshSession();
          return await send<T>(path, init, useAuthStore.getState().token);
        } catch {
          useAuthStore.getState().sessionExpired();
        }
      }
      throw error;
    }
  }

  if (auth.sessionActive) {
    // (2) Access token expired/undecodable but the tab still holds a session →
    //     proactive single-flight refresh, then send with the new header. On
    //     failure: clear the session, prompt re-login, and continue anonymously
    //     so public requests still resolve. No 401 handler on this send: we
    //     refreshed moments earlier and another refresh-retry would only burn
    //     rotation.
    try {
      await useAuthStore.getState().refreshSession();
      return await send<T>(path, init, useAuthStore.getState().token);
    } catch {
      useAuthStore.getState().sessionExpired();
    }
    return send<T>(path, init);
  }

  // (3) No session → anonymous. Only live tokens are ever attached, so expired
  //     ones never go out.
  return send<T>(path, init);
}
