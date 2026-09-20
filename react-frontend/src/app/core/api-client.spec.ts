import { vi } from 'vitest';
import { environment } from '../../environments/environment';
import { authResponse, jsonResponse, makeToken, unauthorized } from '../../test/helpers';
import type { JwtClaims } from 'util/jwt-util';
import type { apiRequest as ApiRequest } from 'core/api-client';
import type { useAuthStore as AuthStore } from 'store/auth-store';
import type { useModalStore as ModalStore } from 'store/modal-store';

const URL_PATH = '/currencies';
const URL = `${environment.apiUrl}${URL_PATH}`;
const LOGIN_PATH = '/auth/login';
const REFRESH_URL = `${environment.apiUrl}/auth/refresh`;

// Ported from Angular's auth.interceptor.spec.ts: the full phase matrix of the
// fetch-wrapper replacement (core/api-client.ts). TestBed + HttpTestingController
// become a fresh module graph (vi.resetModules) + a stubbed global fetch.
let apiRequest: typeof ApiRequest;
let authStore: typeof AuthStore;
let modalStore: typeof ModalStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  ({ apiRequest } = await import('core/api-client'));
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

function callsTo(url: string): { url: string; headers: Record<string, string> }[] {
  return fetchMock.mock.calls
    .filter(([requestUrl]) => String(requestUrl) === url)
    .map((call) => ({ url: String(call[0]), headers: call[1].headers as Record<string, string> }));
}

/** Seed a genuine session (the Angular specs drove a real login through the mock backend). */
function seedSession(claims: Partial<JwtClaims> = {}): string {
  const accessToken = makeToken(claims);
  auth().applyAuthenticationResponse({ accessToken });
  return accessToken;
}

describe('api client', () => {
  it('adds no Authorization header without a session', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await apiRequest(URL_PATH);

    const init = fetchMock.mock.calls[0]![1];
    expect('Authorization' in init.headers).toBe(false);
  });

  it('attaches the Bearer header for a live session', async () => {
    const accessToken = seedSession({ sub: 'a@b.c' });
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await apiRequest(URL_PATH);

    expect(String(fetchMock.mock.calls[0]![0])).toBe(URL);
    expect(fetchMock.mock.calls[0]![1].headers['Authorization']).toBe(`Bearer ${accessToken}`);
  });

  it('leaves non-/auth requests uncredentialed (Bearer-only; the cookie is Path=/auth)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await apiRequest(URL_PATH);

    expect(fetchMock.mock.calls[0]![1].credentials).toBeUndefined();
  });

  it('refreshes proactively when the access token is expired, then sends with the new token', async () => {
    seedSession({ exp: Math.floor(Date.now() / 1000) - 10 });
    const rotated = makeToken({ sub: 'user@test.com' });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ accessToken: rotated })) // refresh
      .mockResolvedValueOnce(jsonResponse([])); // the real request
    await apiRequest(URL_PATH);

    const refreshCall = fetchMock.mock.calls[0]!;
    expect(String(refreshCall[0])).toBe(REFRESH_URL);
    expect(refreshCall[1].body).toBeUndefined();
    // The refresh call itself bypasses the client's auth logic: no header, no recursion.
    expect('Authorization' in refreshCall[1].headers).toBe(false);
    expect(refreshCall[1].credentials).toBe('include');

    const requestCall = fetchMock.mock.calls[1]!;
    expect(String(requestCall[0])).toBe(URL);
    expect(requestCall[1].headers['Authorization']).toBe(`Bearer ${rotated}`);
  });

  it('clears the session and opens the login modal when a proactive refresh fails', async () => {
    seedSession({ exp: Math.floor(Date.now() / 1000) - 10 });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(unauthorized(), 401)) // refresh fails
      .mockResolvedValueOnce(jsonResponse([])); // continues anonymously so public requests still resolve
    const result = await apiRequest(URL_PATH);

    expect(result).toEqual([]);
    expect('Authorization' in fetchMock.mock.calls[1]![1].headers).toBe(false);
    expect(auth().token).toBeNull();
    expect(auth().sessionActive).toBe(false);
    expect(modalStore.getState().loginVisible).toBe(true);
  });

  it('retries once with the rotated token after a reactive 401', async () => {
    seedSession();
    const rotated = makeToken({ sub: 'user@test.com' });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(unauthorized(), 401)) // original 401
      .mockResolvedValueOnce(jsonResponse({ accessToken: rotated })) // refresh
      .mockResolvedValueOnce(jsonResponse([])); // retry
    await apiRequest(URL_PATH);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryCall = fetchMock.mock.calls[2]!;
    expect(String(retryCall[0])).toBe(URL);
    expect(retryCall[1].headers['Authorization']).toBe(`Bearer ${rotated}`);
  });

  it('propagates the original error when the retried request fails again, without a second refresh', async () => {
    seedSession();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(unauthorized(), 401)) // original 401
      .mockResolvedValueOnce(jsonResponse({ accessToken: makeToken() })) // refresh
      .mockResolvedValueOnce(jsonResponse(unauthorized(), 401)); // retry fails

    await expect(apiRequest(URL_PATH)).rejects.toMatchObject({ status: 401 });
    // Exactly one refresh happened: original + refresh + retry, nothing else.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(callsTo(REFRESH_URL)).toHaveLength(1);
    // The session was handed off to sessionExpired() on the failed retry.
    expect(modalStore.getState().loginVisible).toBe(true);
  });

  it('does not attempt a refresh when an /auth request 401s (login failure path)', async () => {
    seedSession();
    fetchMock.mockResolvedValueOnce(jsonResponse(unauthorized(), 401));

    await expect(apiRequest(LOGIN_PATH, { method: 'POST', body: { email: 'a@b.c', password: 'wrong' } })).rejects
      .toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1); // no refresh queued
  });

  it('shares one refresh across concurrent 401s (single-flight)', async () => {
    seedSession();
    const rotated = makeToken({ sub: 'user@test.com' });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(unauthorized(), 401)) // original #1
      .mockResolvedValueOnce(jsonResponse(unauthorized(), 401)) // original #2
      .mockResolvedValueOnce(jsonResponse({ accessToken: rotated })) // ONE refresh
      .mockResolvedValueOnce(jsonResponse([])) // retry #1
      .mockResolvedValueOnce(jsonResponse([])); // retry #2

    const [first, second] = await Promise.all([apiRequest(URL_PATH).catch(() => undefined), apiRequest(URL_PATH).catch(() => undefined)]);

    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(callsTo(REFRESH_URL)).toHaveLength(1);
    const retries = callsTo(URL).slice(2); // 2 originals + 2 retries
    expect(retries).toHaveLength(2);
    retries.forEach((call) => expect(call.headers['Authorization']).toBe(`Bearer ${rotated}`));
  });

  it('lets /auth/refresh pass through untouched even with a live session', async () => {
    seedSession();
    const rotated = authResponse();
    fetchMock.mockResolvedValueOnce(jsonResponse(rotated));

    await apiRequest('/auth/refresh', { method: 'POST' });

    const call = fetchMock.mock.calls[0]!;
    expect(String(call[0])).toBe(REFRESH_URL);
    expect('Authorization' in call[1].headers).toBe(false);
  });
});
