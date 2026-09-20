import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { jsonResponse } from '../../../../test/helpers';
import type { ChangePassword } from 'component/modal-form/change-password/change-password';
import type { useModalStore as ModalStore } from 'store/modal-store';

let ChangePasswordModal: typeof ChangePassword;
let modalStore: typeof ModalStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  ({ ChangePassword: ChangePasswordModal } = await import('component/modal-form/change-password/change-password'));
  ({ useModalStore: modalStore } = await import('store/modal-store'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function renderModal(): void {
  render(<ChangePasswordModal />);
}

async function fillValidForm(): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Old Password'), 'OldPassw0rd!');
  await user.type(screen.getByLabelText('New Password'), 'NewPassw0rd!');
  await user.type(screen.getByLabelText('Confirm New Password'), 'NewPassw0rd!');
}

describe('ChangePassword modal', () => {
  it('renders nothing until the store opens it', () => {
    renderModal();
    expect(screen.queryByText('Change Password')).toBeNull();
  });

  it('keeps submit disabled until all three fields are valid and matching', async () => {
    modalStore.getState().openChangePassword();
    renderModal();
    const user = userEvent.setup();
    const submit = screen.getByRole('button', { name: 'Change Password' });

    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText('Old Password'), 'OldPassw0rd!');
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText('New Password'), 'NewPassw0rd!');
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText('Confirm New Password'), 'NewPassw0rd!X');
    expect(submit).toBeDisabled(); // mismatch
    await user.type(screen.getByLabelText('Confirm New Password'), '{backspace}');
    expect(submit).toBeEnabled();
  });

  it('sends only old/new passwords (confirm is client-side only) and closes on success', async () => {
    modalStore.getState().openChangePassword();
    renderModal();
    await fillValidForm();
    fetchMock.mockResolvedValueOnce(jsonResponse({ messag: 'Password changed' }));

    await userEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => expect(screen.queryByText('Change Password')).toBeNull());
    expect(String(fetchMock.mock.calls[0]![0])).toBe('http://localhost:8082/auth/change-password');
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body).toEqual({ oldPassword: 'OldPassw0rd!', newPassword: 'NewPassw0rd!' });
  });

  it('surfaces the normalized API error on failure', async () => {
    modalStore.getState().openChangePassword();
    renderModal();
    await fillValidForm();
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 400, message: 'Wrong old password' }, 400)); // the global handler's error shape

    await userEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => expect(screen.getByText('Wrong old password')).toBeInTheDocument());
  });
});
