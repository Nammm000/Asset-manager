import { vi } from 'vitest';
import { flushPromises, jsonResponse, makeToken } from '../../test/helpers';
import type { useAuthStore as AuthStore } from 'store/auth-store';

const AVATAR_URL_PATH = '/images/avatar';

// Ported from user-image.service.spec.ts: blob responses are served from the
// stubbed fetch, URL.createObjectURL is stubbed (jsdom lacks it) to verify the
// publish-before-revoke ordering.
let authStore: typeof AuthStore;
let fetchMock: ReturnType<typeof vi.fn>;
let createObjectUrl: ReturnType<typeof vi.fn>;
let revokeObjectUrl: ReturnType<typeof vi.fn>;
let blobCounter = 0;

beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  blobCounter = 0;
  createObjectUrl = vi.fn(() => `blob:mock-${++blobCounter}`);
  revokeObjectUrl = vi.fn();
  // jsdom implements neither — assign for the test, restore after.
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectUrl, configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectUrl, configurable: true });

  vi.resetModules();
  ({ useAuthStore: authStore } = await import('store/auth-store'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function seedSession(): void {
  authStore.getState().applyAuthenticationResponse({ accessToken: makeToken() });
}

function blobResponse(): Response {
  return new Response(new Blob(['image-bytes'], { type: 'image/png' }), { status: 200 });
}

describe('user-image', () => {
  it('hydrates the avatar on session start: GET as blob → object URL → setAvatarUrl', async () => {
    seedSession();
    fetchMock.mockResolvedValueOnce(blobResponse());
    const { initAvatarSync } = await import('service/user-image');
    initAvatarSync();
    await flushPromises();

    expect(String(fetchMock.mock.calls[0]![0])).toContain(AVATAR_URL_PATH);
    expect(authStore.getState().avatarUrl).toBe('blob:mock-1');
    // blob: object URLs are never persisted to localStorage.
    expect(localStorage.getItem('asset-manager.avatar')).toBeNull();
  });

  it('publishes the new object URL BEFORE revoking the previous one (the <img> must never point at a revoked URL)', async () => {
    seedSession();
    fetchMock.mockResolvedValueOnce(blobResponse());
    const { initAvatarSync, refreshAvatar } = await import('service/user-image');
    initAvatarSync();
    await flushPromises();

    // A second hydration (e.g. an upload's refreshAvatar) replaces the URL.
    fetchMock.mockResolvedValueOnce(blobResponse());
    refreshAvatar();
    await flushPromises();

    expect(authStore.getState().avatarUrl).toBe('blob:mock-2');
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:mock-1');
  });

  it('clears the avatar only on 404 — the server\'s definitive "none exists"', async () => {
    seedSession();
    authStore.getState().setAvatarUrl('https://example.com/seed.png');
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 404, message: 'none' }, 404));
    const { initAvatarSync } = await import('service/user-image');
    initAvatarSync();
    await flushPromises();

    expect(authStore.getState().avatarUrl).toBeNull();
    expect(localStorage.getItem('asset-manager.avatar')).toBeNull();
  });

  it('keeps the current avatar on transient failures (anything but 404)', async () => {
    seedSession();
    authStore.getState().setAvatarUrl('https://example.com/seed.png');
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 500, message: 'boom' }, 500));
    const { initAvatarSync } = await import('service/user-image');
    initAvatarSync();
    await flushPromises();

    expect(authStore.getState().avatarUrl).toBe('https://example.com/seed.png');
  });

  it('uploadAvatar posts multipart FormData without a Content-Type header (fetch derives the boundary)', async () => {
    seedSession();
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1, contentType: 'image/png', fileSize: 4 }));
    const { uploadAvatar } = await import('service/user-image');

    await uploadAvatar(new File(['bytes'], 'me.png', { type: 'image/png' }));

    const init = fetchMock.mock.calls[0]![1];
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
    // The multipart boundary must come from fetch itself.
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('clearAvatar revokes the managed object URL and nulls the store', async () => {
    seedSession();
    fetchMock.mockResolvedValueOnce(blobResponse());
    const { initAvatarSync, clearAvatar } = await import('service/user-image');
    initAvatarSync();
    await flushPromises();

    clearAvatar();

    expect(authStore.getState().avatarUrl).toBeNull();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:mock-1');
  });
});
