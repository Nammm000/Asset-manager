import { create } from 'zustand';
import {
  AuthenticationResponse,
  ChangePasswordRequest,
  EmailRequest,
  LoginRequest,
  SignupRequest,
} from 'model/auth.model';
import { MessageResponse } from 'model/common.model';
import { JwtClaims, decodeJwt, isExpired } from 'util/jwt-util';
import { useModalStore } from 'store/modal-store';
import { rawRequest } from 'core/http';

/**
 * Every /auth call is credentialed: the HttpOnly refresh cookie must flow both
 * ways (stored on login/signup/refresh, sent on refresh/logout, cleared on
 * logout/change-password). Cross-origin cookies are only attached to requests
 * made with credentials: 'include'.
 */
const AUTH_CREDENTIALS = { credentials: 'include' } as const;

/** Legacy localStorage keys from the pre-cookie design; purged once at module init. */
const LEGACY_TOKEN_KEY = 'asset-manager.token';
const LEGACY_REFRESH_KEY = 'asset-manager.refreshToken';
const AVATAR_STORAGE_KEY = 'asset-manager.avatar';

interface AuthState {
  /** Memory-only access token; always null on startup. */
  token: string | null;
  claims: JwtClaims | null;
  /**
   * The HttpOnly refresh cookie is invisible to JS, so this in-memory flag
   * replaces its old presence check as "this tab believes a session can be
   * revived" — set on login/signup/refresh, cleared on logout/session expiry.
   */
  sessionActive: boolean;
  /** Hydrated by user-image on every session start (blob: object URL). Deliberately NOT cleared on logout. */
  avatarUrl: string | null;

  login(request: LoginRequest): Promise<AuthenticationResponse>;
  signup(request: SignupRequest): Promise<AuthenticationResponse>;
  refreshSession(): Promise<AuthenticationResponse>;
  restoreSession(): Promise<void>;
  sessionExpired(): void;
  logout(): void;
  changePassword(body: ChangePasswordRequest): Promise<MessageResponse>;
  forgotPassword(body: EmailRequest): Promise<MessageResponse>;
  applyAuthenticationResponse(response: AuthenticationResponse): void;
  setAvatarUrl(url: string | null): void;
  clearSession(): void;
  hasLiveAccessToken(): boolean;
  /** Optimistic: live access token OR sessionActive. Claims stay populated from an expired token so email/role keep rendering. Still a method, not derived state — Date.now() isn't reactive. */
  isAuthenticated(): boolean;
}

/**
 * Ported from Angular's AuthService (the single auth facade). The access token
 * lives ONLY in memory — reloading the page empties it; restoreSession()
 * rebuilds the session from the HttpOnly refresh cookie (which JS can neither
 * read nor even detect, hence the blind startup refresh in main.tsx).
 */
export const useAuthStore = create<AuthState>()((set, get) => ({
  token: null,
  claims: null,
  sessionActive: false,
  avatarUrl: readStoredAvatar(),

  login: async (request) => {
    const response = await rawRequest<AuthenticationResponse>('/auth/login', {
      method: 'POST',
      body: request,
      ...AUTH_CREDENTIALS,
    });
    get().applyAuthenticationResponse(response);
    return response;
  },

  // Signup auto-logs-in: the backend returns a fresh access token for the new user.
  signup: async (request) => {
    const response = await rawRequest<AuthenticationResponse>('/auth/signup', {
      method: 'POST',
      body: request,
      ...AUTH_CREDENTIALS,
    });
    get().applyAuthenticationResponse(response);
    return response;
  },

  /**
   * Exchange the refresh cookie for a rotated pair (new access token + new
   * cookie). Single-flight via requestRefresh(): concurrent callers share one
   * request — rotation deletes the old token server-side, so a second
   * concurrent call would replay a deleted token and 401 the whole session.
   */
  refreshSession: async () => {
    if (!get().sessionActive) {
      throw new Error('No active session');
    }
    return requestRefresh();
  },

  /**
   * Startup hydration (called from main.tsx before render): the access token is
   * memory-only and the refresh cookie invisible, so the only way to learn
   * whether a session exists is to try one refresh. 401 here is a normal guest
   * visit — resolved silently, never via sessionExpired()/the login modal.
   */
  restoreSession: async () => {
    if (get().hasLiveAccessToken() || get().sessionActive) {
      return;
    }
    await requestRefresh().catch(() => undefined);
  },

  // Session is dead (refresh failed mid-session): wipe local state and prompt re-login.
  sessionExpired: () => {
    get().clearSession();
    useModalStore.getState().openLogin();
  },

  logout: () => {
    const email = get().claims?.sub ?? null;
    if (email === null) {
      get().clearSession();
      return;
    }
    const fireLogout = (): void => {
      // No body: the HttpOnly cookie identifies the token to revoke server-side.
      // Fire the request while the session is still live (Bearer attached only
      // when the token is live), then clear local state. Local clearing is the
      // real logout and must happen even if this call fails.
      const state = get();
      const headers: Record<string, string> =
        state.token !== null && state.claims !== null && !isExpired(state.claims)
          ? { Authorization: `Bearer ${state.token}` }
          : {};
      void rawRequest('/auth/logout', { method: 'POST', body: null, headers, ...AUTH_CREDENTIALS }).catch(
        () => undefined,
      );
      state.clearSession();
    };
    // /auth/logout is JWT-protected: when the access token has expired but the
    // tab still holds a session, refresh first so the logout call gets its
    // header. On refresh failure just log out locally — never flash the login
    // modal on a deliberate logout.
    if (!get().hasLiveAccessToken() && get().sessionActive) {
      void requestRefresh().then(fireLogout, fireLogout);
    } else {
      fireLogout();
    }
  },

  forgotPassword: async (body) => {
    return rawRequest<MessageResponse>('/auth/forgot-password', {
      method: 'POST',
      body,
      ...AUTH_CREDENTIALS,
    });
  },

  /**
   * POST /auth/change-password (JWT-protected, credentialed — it clears the
   * cookie and revokes refresh tokens server-side). /auth/* URLs skip the
   * reactive 401 retry but still get the proactive refresh when the access
   * token is expired (interceptor phase 2): refresh first, and on failure
   * sessionExpired() + continue anonymously so the caller sees the real error.
   */
  changePassword: async (body) => {
    if (!get().hasLiveAccessToken() && get().sessionActive) {
      try {
        await requestRefresh();
      } catch {
        get().sessionExpired();
      }
    }
    // Anonymous when no session survived the branch above — the 401 then
    // surfaces to the caller, matching the interceptor's anonymous continue.
    const { token, claims } = get();
    const headers: Record<string, string> =
      token !== null && claims !== null && !isExpired(claims) ? { Authorization: `Bearer ${token}` } : {};
    return rawRequest<MessageResponse>('/auth/change-password', {
      method: 'POST',
      body,
      headers,
      ...AUTH_CREDENTIALS,
    });
  },

  /**
   * Install a login/signup/refresh response as the in-memory session. Public
   * on purpose: specs use it to seed sessions now that tokens are never
   * persisted.
   */
  applyAuthenticationResponse: (response) => {
    set({ token: response.accessToken, claims: decodeJwt(response.accessToken), sessionActive: true });
  },

  /**
   * Set (or clear with null) the avatar URL. Only http(s) URLs persist —
   * blob: object URLs die with the document, so storing one would restore a
   * dead URL on reload (setting one also removes any stored legacy seed).
   */
  setAvatarUrl: (url) => {
    set({ avatarUrl: url });
    if (url === null || url.startsWith('blob:')) {
      localStorage.removeItem(AVATAR_STORAGE_KEY);
    } else {
      localStorage.setItem(AVATAR_STORAGE_KEY, url);
    }
  },

  clearSession: () => {
    set({ token: null, claims: null, sessionActive: false });
  },

  /** The access token exists, decodes and has not expired. */
  hasLiveAccessToken: () => {
    const { token, claims } = get();
    return token !== null && claims !== null && !isExpired(claims);
  },

  isAuthenticated: () => get().hasLiveAccessToken() || get().sessionActive,
}));

/**
 * Shared single-flight refresh core (also used by restoreSession, which must
 * run without the sessionActive precondition — its whole job is discovering
 * one). Empty body: the refresh cookie is both credential and token to rotate.
 * The promise is module-private so it never triggers renders; `.finally`
 * clears it once — the RxJS finalize-before-share semantics.
 */
let refreshInFlight: Promise<AuthenticationResponse> | null = null;

function requestRefresh(): Promise<AuthenticationResponse> {
  if (refreshInFlight === null) {
    refreshInFlight = rawRequest<AuthenticationResponse>('/auth/refresh', {
      method: 'POST',
      body: null,
      ...AUTH_CREDENTIALS,
    })
      .then((response) => {
        useAuthStore.getState().applyAuthenticationResponse(response);
        return response;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/** Remove pre-cookie-design localStorage tokens; they are dead weight now. */
function purgeLegacyStorage(): void {
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_KEY);
}

function readStoredAvatar(): string | null {
  return localStorage.getItem(AVATAR_STORAGE_KEY);
}

purgeLegacyStorage();

// Selectors (the Angular email/role computeds). Select call results or
// primitives like these — never bare action refs, which are stable and would
// never re-render.
export const selectEmail = (state: AuthState): string | null => state.claims?.sub ?? null;
export const selectRole = (state: AuthState) => state.claims?.role ?? null;
export const selectIsAdmin = (state: AuthState): boolean => state.claims?.role === 'ROLE_ADMIN';
