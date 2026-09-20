import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { jsonResponse, makeToken } from '../../../../test/helpers';
import type { Signup } from 'component/modal-form/signup/signup';
import type { useModalStore as ModalStore } from 'store/modal-store';

let SignupModal: typeof Signup;
let modalStore: typeof ModalStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  ({ Signup: SignupModal } = await import('component/modal-form/signup/signup'));
  ({ useModalStore: modalStore } = await import('store/modal-store'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function renderModal(): void {
  render(
    <MemoryRouter>
      <SignupModal />
    </MemoryRouter>,
  );
}

async function fillValidForm(): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'new@b.c');
  await user.type(screen.getByLabelText('Name'), 'New User');
  await user.type(screen.getByLabelText('Phone'), '0123456789');
  await user.type(screen.getByLabelText('Password'), 'Passw0rd!');
  await user.type(screen.getByLabelText('Confirm Password'), 'Passw0rd!');
}

describe('Signup modal', () => {
  it('renders nothing until the store opens it', () => {
    renderModal();
    expect(screen.queryByText('Sign Up')).toBeNull();
  });

  it('shows per-field validation messages only for non-empty invalid values', async () => {
    modalStore.getState().openSignup();
    renderModal();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'nope');
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'bad * name');
    expect(screen.getByText('Please enter a valid name')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Phone'), '12345');
    expect(screen.getByText('Please enter a valid phone number')).toBeInTheDocument();
  });

  it('renders the password checklist with unmet rules marked invalid, collapsing to a success message when all pass', async () => {
    modalStore.getState().openSignup();
    renderModal();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Password'), 'weak');
    const checklist = screen.getByText('* At least 8 characters').closest('div.password-requirements')!;
    expect(checklist).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'Passw0rd!');
    expect(screen.queryByText('* At least 8 characters')).toBeNull();
    expect(screen.getByText('Password meets all requirements')).toBeInTheDocument();
  });

  it('flags a mismatching confirmation password', async () => {
    modalStore.getState().openSignup();
    renderModal();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await user.type(screen.getByLabelText('Confirm Password'), 'Passw0rd');

    expect(screen.getByText('Password must match the input password')).toBeInTheDocument();
  });

  it('signs up credentialed and closes on success (auto-login)', async () => {
    modalStore.getState().openSignup();
    renderModal();
    await fillValidForm();
    fetchMock.mockResolvedValueOnce(jsonResponse({ accessToken: makeToken({ sub: 'new@b.c' }) }));

    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    await waitFor(() => expect(screen.queryByText('Sign Up')).toBeNull());
    expect(String(fetchMock.mock.calls[0]![0])).toBe('http://localhost:8082/auth/signup');
    expect(fetchMock.mock.calls[0]![1].credentials).toBe('include');
    expect(fetchMock.mock.calls[0]![1].body).toContain('"phone":"0123456789"');
  });

  it('shows the API error and keeps the modal open on failure', async () => {
    modalStore.getState().openSignup();
    renderModal();
    await fillValidForm();
    fetchMock.mockResolvedValueOnce(jsonResponse('Email already exists!', 400));

    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    await waitFor(() => expect(screen.getByText('Email already exists!')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeEnabled();
  });
});
