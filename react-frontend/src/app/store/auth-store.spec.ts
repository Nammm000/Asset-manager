import { vi } from 'vitest';
import { environment } from '../../environments/environment';
import { authResponse, flushPromises, jsonResponse, makeToken, unauthorized } from '../../test/helpers';
import type { JwtClaims } from 'util/jwt-util';
import type { useAuthStore as AuthStore } from 'store/auth-store';
import type { useModalStore as ModalStore } from 'store/modal-store';

const STORAGE_KEY = 'asset-manager.token';
const REFRESH_KEY = 'asset-manager.refreshToken';
const AVATAR_KEY = 'asset-manager.avatar';
const LOGIN_URL = `${environment.apiUrl}/auth/login`;
const LOGOUT_URL = `${environment.apiUrl}/auth/logout`;
const REFRESH_URL = `${environment.apiUrl}/auth/refresh`;

// Ported from Angular's auth.service.spec.ts. TestBed's per-test injector is
// replaced by vi.resetModules() + dynamic import: the store module graph
// re-executes fresh each test (module-level init — legacy-key purge, avatar
// restore — runs like a constructor would), and the mock backend becomes a
// stubbed global fetch.
let authStore: typeof AuthStore;
let modalStore: typeof ModalStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  ({ useAuthStore: authStore } = await import('store/auth-store'));
  ({ useModalStore: modalStore } = await import('store/modal-store'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function auth(): ReturnType<typeof authStore.getState> {
  return authStore.getState();
}

function callsTo(url: string): { credentials?: string }[] {
  return fetchMock.mock.calls
    .filter(([requestUrl]) => String(requestUrl) === url)
    .map((call) => call[1] as { credentials?: string });
}

/** Log in through the mocked fetch so the session state is genuine. */
async function login(claims: Partial<JwtClaims> = {}): Promise<string> {
  const accessToken = makeToken(claims);
  fetchMock.mockResolvedValueOnce(jsonResponse({ accessToken }));
  await auth().login({ email: 'a@b.c', password: 'pw' });
  return accessToken;
}

describe('auth store', () => {
  it('installs the token, decodes claims, and keeps the session in memory on login', async () => {
    const accessToken = await login({ sub: 'a@b.c', role: 'ROLE_ADMIN' });

    expect(auth().token).toBe(accessToken);
    expect(auth().claims?.sub).toBe('a@b.c');
    expect(auth().claims?.role).toBe('ROLE_ADMIN');
    expect(auth().sessionActive).toBe(true);
    expect(auth().isAuthenticated()).toBe(true);
    // Memory-only: nothing is ever written to localStorage.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it('sends the login request credentialed so the cookie can be stored', async () => {
    await login();
    const call = fetchMock.mock.calls[0]!;
    expect(String(call[0])).toBe(LOGIN_URL);
    expect(call[1].credentials).toBe('include');
    expect(call[1].method).toBe('POST');
  });

  it('leaves state untouched when login fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 400, message: 'Incorrect username or password!' }, 400));
    await auth().login({ email: 'a@b.c', password: 'wrong' }).catch(() => undefined);

    expect(auth().token).toBeNull();
    expect(auth().sessionActive).toBe(false);
    expect(auth().isAuthenticated()).toBe(false);
  });

  it('stays authenticated with an expired access token while a session is active', async () => {
    const expiredToken = await login({ exp: Math.floor(Date.now() / 1000) - 10 });

    expect(auth().token).toBe(expiredToken);
    expect(auth().hasLiveAccessToken()).toBe(false);
    // Optimistic: the HttpOnly cookie may still revive the session.
    expect(auth().isAuthenticated()).toBe(true);
  });

  it('installs the session on signup (backend auto-logs-in the new user)', async () => {
    const accessToken = makeToken({ sub: 'new@b.c' });
    fetchMock.mockResolvedValueOnce(jsonResponse({ accessToken }));
    await auth().signup({ name: 'New', email: 'new@b.c', phone: '0123456789', password: 'Passw0rd!' });
    expect(String(fetchMock.mock.calls[0]![0])).toBe(`${environment.apiUrl}/auth/signup`);

    expect(auth().token).toBe(accessToken);
    expect(auth().claims?.sub).toBe('new@b.c');
    expect(auth().sessionActive).toBe(true);
    expect(auth().isAuthenticated()).toBe(true);
  });

  it('clears local session on logout even when the API call fails', async () => {
    await login({ sub: 'a@b.c' });

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'gone' }, 404));
    auth().logout();
    await vi.waitFor(() => expect(auth().token).toBeNull());

    const call = fetchMock.mock.calls.find(([url]) => String(url) === LOGOUT_URL)!;
    // No body: the HttpOnly cookie identifies the token to revoke server-side.
    expect(call[1].body).toBeUndefined();
    expect(call[1].credentials).toBe('include');
    expect(auth().sessionActive).toBe(false);
    expect(auth().claims).toBeNull();
    expect(auth().isAuthenticated()).toBe(false);
  });

  it('refreshes first when the access token is expired so logout gets its Bearer header', async () => {
    await login({ sub: 'a@b.c', exp: Math.floor(Date.now() / 1000) - 10 });

    const rotated = makeToken({ sub: 'a@b.c' });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ accessToken: rotated })) // refresh
      .mockResolvedValueOnce(jsonResponse({ message: 'Logout OK' })); // logout
    auth().logout();
    await vi.waitFor(() => expect(auth().token).toBeNull());

    expect(String(fetchMock.mock.calls[1]![0])).toBe(REFRESH_URL); // [0] is the login call
    const logoutCall = fetchMock.mock.calls.find(([url]) => String(url) === LOGOUT_URL)!;
    expect(logoutCall[1].headers['Authorization']).toBe(`Bearer ${rotated}`);
    expect(auth().isAuthenticated()).toBe(false);
  });

  it('still logs out locally when the pre-logout refresh fails', async () => {
    await login({ sub: 'a@b.c', exp: Math.floor(Date.now() / 1000) - 10 });

    fetchMock
      .mockResolvedValueOnce(jsonResponse(unauthorized(), 401)) // refresh fails
      .mockResolvedValueOnce(jsonResponse({ message: 'Logout OK' })); // logout still fires
    auth().logout();
    await vi.waitFor(() => expect(auth().token).toBeNull());

    expect(auth().isAuthenticated()).toBe(false);
    // A deliberate logout never flashes the login modal.
    expect(modalStore.getState().loginVisible).toBe(false);
  });

  it('clears the session and opens the login modal on sessionExpired()', async () => {
    await login({ sub: 'a@b.c' });

    auth().sessionExpired();

    expect(auth().token).toBeNull();
    expect(auth().sessionActive).toBe(false);
    expect(auth().isAuthenticated()).toBe(false);
    expect(modalStore.getState().loginVisible).toBe(true);
  });
});

describe('auth store (refreshSession)', () => {
  it('rejects immediately when no session is active (and never issues HTTP)', async () => {
    await expect(auth().refreshSession()).rejects.toThrow('No active session');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shares a single credentialed cookie-refresh between concurrent callers (rotation-safe)', async () => {
    await login({ sub: 'a@b.c' });

    const rotated = authResponse({ sub: 'a@b.c' });
    fetchMock.mockResolvedValueOnce(jsonResponse(rotated));
    const first = auth().refreshSession();
    const second = auth().refreshSession();

    const results = await Promise.all([first, second]);
    expect(callsTo(REFRESH_URL)).toHaveLength(1);
    expect(callsTo(REFRESH_URL)[0]!.credentials).toBe('include');
    expect(results.map((r) => r.accessToken)).toEqual([rotated.accessToken, rotated.accessToken]);
    expect(auth().token).toBe(rotated.accessToken);
    expect(auth().sessionActive).toBe(true);
  });

  it('propagates a failed refresh to all callers and clears the in-flight request', async () => {
    await login({ sub: 'a@b.c' });

    fetchMock.mockResolvedValueOnce(jsonResponse(unauthorized(), 401));
    const callers = await Promise.allSettled([auth().refreshSession(), auth().refreshSession()]);
    expect(callers.filter((c) => c.status === 'rejected')).toHaveLength(2);
    expect(callsTo(REFRESH_URL)).toHaveLength(1);

    // The in-flight slot was freed: a new call issues a fresh request.
    fetchMock.mockResolvedValueOnce(jsonResponse(unauthorized(), 401));
    await auth().refreshSession().catch(() => undefined);
    expect(callsTo(REFRESH_URL)).toHaveLength(2);
  });
});

describe('auth store (session restore)', () => {
  it('restores the session from the refresh cookie via one credentialed refresh', async () => {
    expect(auth().token).toBeNull();

    const restored = authResponse({ sub: 'stored@b.c' });
    fetchMock.mockResolvedValueOnce(jsonResponse(restored));
    const promise = auth().restoreSession();

    expect(String(fetchMock.mock.calls[0]![0])).toBe(REFRESH_URL);
    expect(fetchMock.mock.calls[0]![1].credentials).toBe('include');
    expect(fetchMock.mock.calls[0]![1].body).toBeUndefined();
    await promise;

    expect(auth().token).toBe(restored.accessToken);
    expect(auth().claims?.sub).toBe('stored@b.c');
    expect(auth().sessionActive).toBe(true);
    expect(auth().isAuthenticated()).toBe(true);
  });

  it('resolves silently as a guest when the cookie is absent or dead (no login modal)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(unauthorized(), 401));

    await auth().restoreSession();

    expect(auth().token).toBeNull();
    expect(auth().sessionActive).toBe(false);
    expect(auth().isAuthenticated()).toBe(false);
    expect(modalStore.getState().loginVisible).toBe(false);
  });

  it('is a no-op when a session already exists (no second refresh)', async () => {
    auth().applyAuthenticationResponse(authResponse({ sub: 'a@b.c' }));

    await auth().restoreSession();

    expect(auth().isAuthenticated()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('purges legacy localStorage token keys at module init but keeps the avatar', async () => {
    // The pre-import keys simulate the pre-cookie design's leftovers; the
    // store's module init (the Angular constructor) purges them on load.
    localStorage.setItem(STORAGE_KEY, makeToken({ sub: 'legacy@b.c' }));
    localStorage.setItem(REFRESH_KEY, 'legacy-refresh');
    localStorage.setItem(AVATAR_KEY, 'https://example.com/me.png');
    vi.resetModules();
    const { useAuthStore: fresh } = await import('store/auth-store');

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(localStorage.getItem(AVATAR_KEY)).toBe('https://example.com/me.png');
    // The legacy token is NOT trusted as a session.
    expect(fresh.getState().token).toBeNull();
    expect(fresh.getState().isAuthenticated()).toBe(false);
  });

  it('restores the avatar URL from localStorage at module init', async () => {
    localStorage.setItem(AVATAR_KEY, 'https://example.com/me.png');
    vi.resetModules();
    const { useAuthStore: fresh } = await import('store/auth-store');

    expect(fresh.getState().avatarUrl).toBe('https://example.com/me.png');
  });
});

describe('auth store (avatar)', () => {
  it('persists the avatar URL through setAvatarUrl and clears it with null', () => {
    auth().setAvatarUrl('https://example.com/other.png');
    expect(auth().avatarUrl).toBe('https://example.com/other.png');
    expect(localStorage.getItem(AVATAR_KEY)).toBe('https://example.com/other.png');

    auth().setAvatarUrl(null);
    expect(auth().avatarUrl).toBeNull();
    expect(localStorage.getItem(AVATAR_KEY)).toBeNull();
  });

  it('never persists blob: object URLs — they die with the document', () => {
    localStorage.setItem(AVATAR_KEY, 'https://example.com/seed.png');

    auth().setAvatarUrl('blob:http://localhost:4200/1234-abc');

    expect(auth().avatarUrl).toBe('blob:http://localhost:4200/1234-abc');
    // Memory-only in storage, and setting it retires the legacy seed.
    expect(localStorage.getItem(AVATAR_KEY)).toBeNull();
  });

  it('keeps the avatar URL on logout', async () => {
    await login({ sub: 'a@b.c' });

    auth().setAvatarUrl('https://example.com/me.png');
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Bye' }));
    auth().logout();
    await flushPromises();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(auth().avatarUrl).toBe('https://example.com/me.png');
    expect(localStorage.getItem(AVATAR_KEY)).toBe('https://example.com/me.png');
  });
});
