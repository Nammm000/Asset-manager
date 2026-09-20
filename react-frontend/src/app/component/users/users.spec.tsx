import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { jsonResponse } from '../../../test/helpers';
import type { Users as UsersComponent } from 'component/users/users';
import type { useModalStore as ModalStore } from 'store/modal-store';
import type { UserWrapper } from 'model/user.model';

// Ported from users.spec.ts: TestBed → RTL render (the list loads on mount),
// HttpTestingController → stubbed fetch, ModalService.confirmation → the modal
// store's confirmation request. The Angular spec drove component methods
// (toggleStatus/onRoleChange/confirmDelete); the React port reaches them
// through their DOM controls.
const USERS_URL = 'http://localhost:8082/users';

const user = (id: number, status = 'true', role: UserWrapper['role'] = 'ROLE_USER'): UserWrapper => ({
  id,
  name: `User ${id}`,
  email: `user${id}@test.com`,
  phone: '0123456789',
  status,
  createdTime: '2026-01-01T10:00:00',
  role,
});

let Users: typeof UsersComponent;
let modalStore: typeof ModalStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  ({ Users } = await import('component/users/users'));
  ({ useModalStore: modalStore } = await import('store/modal-store'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

type FetchCall = [url: unknown, init: { method: string; body?: unknown }];

function patchCalls(): FetchCall[] {
  return fetchMock.mock.calls.filter(([, init]) => init.method === 'PATCH') as unknown as FetchCall[];
}

describe('Users', () => {
  it('loads the plain (non-paged) list on init', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([user(1), user(2)]));
    render(<Users />);

    expect(await screen.findByText('user1@test.com')).toBeInTheDocument();
    expect(screen.getByText('user2@test.com')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('toggles status with the stringly-typed body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([user(1, 'true')]));
    render(<Users />);
    await screen.findByText('user1@test.com');

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ messag: 'Updated' })) // PATCH status
      .mockResolvedValueOnce(jsonResponse([user(1, 'false')])); // reload
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    const patch = patchCalls()[0]!;
    expect(String(patch[0])).toBe(`${USERS_URL}/1/status`);
    expect(JSON.parse(patch[1].body as string)).toEqual({ status: 'false' }); // stringly, not boolean

    await waitFor(() => expect(screen.getByText('Inactive')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument();
  });

  it('changes role via the select handler', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([user(1)]));
    render(<Users />);
    await screen.findByText('user1@test.com');

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ messag: 'Updated' })) // PATCH role
      .mockResolvedValueOnce(jsonResponse([user(1, 'true', 'ROLE_ADMIN')])); // reload
    const roleSelect = screen.getByLabelText('Role for user1@test.com');
    await userEvent.selectOptions(roleSelect, 'ROLE_ADMIN');

    const patch = patchCalls()[0]!;
    expect(String(patch[0])).toBe(`${USERS_URL}/1/role`);
    expect(JSON.parse(patch[1].body as string)).toEqual({ role: 'ROLE_ADMIN' });

    await waitFor(() =>
      expect(screen.getByLabelText('Role for user1@test.com')).toHaveValue('ROLE_ADMIN'),
    );
  });

  it('skips the PATCH when the selected role is unchanged', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([user(1)]));
    render(<Users />);
    await screen.findByText('user1@test.com');

    // Angular synthesized a change event carrying the same value to hit the
    // handler's early return; fireEvent.change dispatches it without
    // selectOptions' only-on-value-change guard.
    fireEvent.change(screen.getByLabelText('Role for user1@test.com'), {
      target: { value: 'ROLE_USER' },
    });

    expect(patchCalls()).toHaveLength(0);
    expect(screen.getByLabelText('Role for user1@test.com')).toHaveValue('ROLE_USER');
  });

  it('deletes after confirmation and reloads', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([user(1)]));
    render(<Users />);
    await screen.findByText('user1@test.com');

    await userEvent.click(screen.getByTitle('Delete'));
    const request = modalStore.getState().confirmation!;
    expect(request.title).toBe('Delete user');
    expect(request.danger).toBe(true);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ messag: 'Deleted' })) // DELETE
      .mockResolvedValueOnce(jsonResponse([])); // reload
    await act(async () => {
      request.onConfirm();
    });

    expect(await screen.findByText('No users found.')).toBeInTheDocument();
    const del = fetchMock.mock.calls.find(([, init]) => init.method === 'DELETE')!;
    expect(String(del[0])).toBe(`${USERS_URL}/1`);
  });
});
