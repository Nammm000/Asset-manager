import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { jsonResponse } from '../../../test/helpers';
import type { UserSetting as UserSettingComponent } from 'component/user-setting/user-setting';
import type { useAuthStore as AuthStore } from 'store/auth-store';
import type { useModalStore as ModalStore } from 'store/modal-store';
import type { UserWrapper } from 'model/user.model';

// Ported from user-setting.spec.ts: TestBed → RTL render, HttpTestingController
// → stubbed fetch, AuthService/ModalService → zustand stores. Avatar object
// URLs need the same URL stubs (jsdom implements neither static).
const CURRENT_USER_URL = 'http://localhost:8082/users/current-user';
const AVATAR_URL = 'http://localhost:8082/images/avatar';

// jsdom implements neither static — the upload path creates object URLs.
const createObjectURL = vi.fn(() => 'blob:mock-1');
const revokeObjectURL = vi.fn();

const currentUser = (overrides: Partial<UserWrapper> = {}): UserWrapper => ({
  id: 1,
  name: 'Test User',
  email: 'user@test.com',
  phone: '0123456789',
  status: 'true',
  createdTime: '2026-01-01T10:00:00',
  role: 'ROLE_USER',
  accountLevel: { id: 2, code: 'VIP', name: 'VIP', description: null },
  accountNumber: 'ACC-001',
  ...overrides,
});

let UserSetting: typeof UserSettingComponent;
let authStore: typeof AuthStore;
let modalStore: typeof ModalStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  localStorage.removeItem('asset-manager.avatar');
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  ({ useAuthStore: authStore } = await import('store/auth-store'));
  ({ useModalStore: modalStore } = await import('store/modal-store'));
  ({ UserSetting } = await import('component/user-setting/user-setting'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
  localStorage.removeItem('asset-manager.avatar');
});

function fileInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('input[type="file"]')!;
}

/**
 * Simulates picking a file exactly like the Angular pickFile helper: seed
 * input.files, fire change. (userEvent.upload's synthesized FileList never
 * reaches the React handler here.)
 */
function pickFile(container: HTMLElement, file: File): void {
  const input = fileInput(container);
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

/** Resolves the next fetch manually, so busy-state assertions can run mid-flight (Angular flushed explicitly). */
function pendingResponse(): { resolve: (response: Response) => void } {
  const handle: { resolve: (response: Response) => void } = { resolve: () => undefined };
  fetchMock.mockImplementationOnce(
    () => new Promise<Response>((resolve) => (handle.resolve = resolve)),
  );
  return handle;
}

describe('UserSetting', () => {
  it('loads the current user on init', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(currentUser()));
    render(<UserSetting />);

    expect(await screen.findByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('user@test.com')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(document.querySelector('.error-banner')).toBeNull();
  });

  it('surfaces the API error message on failure', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 403, message: 'Forbidden', timeStamp: 1 }, 403),
    );
    render(<UserSetting />);

    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('Test User')).toBeNull();
  });

  it('keeps account-level fields optional (admin list shape)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(currentUser({ accountLevel: undefined, accountNumber: null })),
    );
    render(<UserSetting />);

    expect(await screen.findByText('Test User')).toBeInTheDocument();
    // Angular asserted profile().accountNumber === null; the visible mirror is the em dash fallback.
    const field = screen.getByText('Account number').closest('.settings-field')!;
    expect(within(field as HTMLElement).getByText('—')).toBeInTheDocument();
  });

  it('opens the change-password modal from the quick action', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(currentUser()));
    render(<UserSetting />);
    await screen.findByText('Test User');

    await userEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    expect(modalStore.getState().changePasswordVisible).toBe(true);
  });

  it('uploads a selected avatar, refreshes it, and shows success', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(currentUser())); // profile load
    const upload = pendingResponse(); // POST /images/avatar stays pending
    fetchMock.mockResolvedValueOnce(new Response(new Blob(['png-bytes'], { type: 'image/png' }))); // re-fetch bytes
    const { container } = render(<UserSetting />);
    await screen.findByText('Test User');

    const file = new File(['png-bytes'], 'avatar.png', { type: 'image/png' });
    pickFile(container, file);

    const post = fetchMock.mock.calls.find(([, init]) => init.method === 'POST')!;
    expect(String(post[0])).toBe(AVATAR_URL);
    // Multipart field name and boundary-less header (fetch derives both).
    expect(post[1].body instanceof FormData).toBe(true);
    expect((post[1].body as FormData).get('file')).toBe(file);
    expect((post[1].headers as Record<string, string>)['Content-Type']).toBeUndefined();
    // Busy gates the actions and the input is reset for a same-file re-pick.
    expect(fileInput(container).value).toBe('');
    expect(screen.getByLabelText('Change avatar')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeDisabled();

    // The upload response is metadata only — the page re-fetches the bytes.
    await act(async () => {
      upload.resolve(jsonResponse({ id: 7, contentType: 'image/png', fileSize: 9 }));
    });

    await waitFor(() => expect(authStore.getState().avatarUrl).toBe('blob:mock-1'));
    expect(screen.getByText('Avatar updated.')).toBeInTheDocument();
    expect(screen.getByLabelText('Change avatar')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeEnabled();
  });

  it('rejects an oversized file with no HTTP at all', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(currentUser()));
    const { container } = render(<UserSetting />);
    await screen.findByText('Test User');

    pickFile(
      container,
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }),
    );

    expect(await screen.findByText('Image must be smaller than 5MB.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeEnabled();
  });

  it('rejects a disallowed file type with no HTTP at all', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(currentUser()));
    const { container } = render(<UserSetting />);
    await screen.findByText('Test User');

    pickFile(container, new File(['gif-bytes'], 'avatar.gif', { type: 'image/gif' }));

    expect(await screen.findByText('Only png, jpeg and webp images are allowed.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(0);
  });

  it('surfaces the server error when the upload fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(currentUser()));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { status: 400, message: 'Only png, jpeg and webp images are allowed.', timeStamp: 1 },
        400,
      ),
    );
    const { container } = render(<UserSetting />);
    await screen.findByText('Test User');

    pickFile(container, new File(['png-bytes'], 'avatar.png', { type: 'image/png' }));

    expect(await screen.findByText('Only png, jpeg and webp images are allowed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeEnabled();
    // No byte re-fetch after a failed upload.
    expect(
      fetchMock.mock.calls.filter(([url, init]) => String(url) === AVATAR_URL && init.method === 'GET'),
    ).toHaveLength(0);
  });

  it('shows the remove action only when an avatar exists', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(currentUser()));
    render(<UserSetting />);
    await screen.findByText('Test User');

    expect(screen.queryByRole('button', { name: 'Remove avatar' })).toBeNull();

    act(() => {
      authStore.getState().setAvatarUrl('blob:mock-1');
    });

    expect(screen.getByRole('button', { name: 'Remove avatar' })).toBeInTheDocument();
  });

  it('removes the avatar through the confirmation dialog', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(currentUser()));
    render(<UserSetting />);
    await screen.findByText('Test User');
    act(() => {
      authStore.getState().setAvatarUrl('blob:mock-1');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Remove avatar' }));
    const request = modalStore.getState().confirmation!;
    expect(request.danger).toBe(true);

    const del = pendingResponse(); // DELETE stays pending
    act(() => {
      request.onConfirm();
    });
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeDisabled(); // avatarBusy gates
    const deleteCall = fetchMock.mock.calls.find(([, init]) => init.method === 'DELETE')!;
    expect(String(deleteCall[0])).toBe(AVATAR_URL);

    await act(async () => {
      del.resolve(jsonResponse({ messag: 'Avatar deleted successfully' }));
    });

    await waitFor(() => expect(authStore.getState().avatarUrl).toBeNull());
    expect(screen.getByText('Avatar removed.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove avatar' })).toBeNull();
  });

  it('treats a remove 404 as success (already deleted elsewhere)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(currentUser()));
    fetchMock.mockResolvedValueOnce(jsonResponse(null, 404));
    render(<UserSetting />);
    await screen.findByText('Test User');
    act(() => {
      authStore.getState().setAvatarUrl('blob:mock-1');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Remove avatar' }));
    await act(async () => {
      modalStore.getState().confirmation!.onConfirm();
    });

    await waitFor(() => expect(authStore.getState().avatarUrl).toBeNull());
    expect(screen.getByText('Avatar removed.')).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/)).toBeNull(); // avatarError stays empty
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeEnabled();
  });

  it('keeps the avatar when removal fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(currentUser()));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 500, message: 'Boom', timeStamp: 1 }, 500),
    );
    render(<UserSetting />);
    await screen.findByText('Test User');
    act(() => {
      authStore.getState().setAvatarUrl('blob:mock-1');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Remove avatar' }));
    await act(async () => {
      modalStore.getState().confirmation!.onConfirm();
    });

    expect(await screen.findByText('Boom')).toBeInTheDocument();
    expect(authStore.getState().avatarUrl).toBe('blob:mock-1');
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeEnabled();
  });
});
