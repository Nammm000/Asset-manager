import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { flushPromises, jsonResponse, makeToken } from '../../../../test/helpers';
import type { Login } from 'component/modal-form/login/login';
import type { useModalStore as ModalStore } from 'store/modal-store';

const LOGIN_URL = 'http://localhost:8082/auth/login';

// Ported from login.spec.ts: TestBed → RTL render of the permanently-mounted
// modal, ModalService → modal-store, HttpTestingController → stubbed fetch.
let LoginModal: typeof Login;
let modalStore: typeof ModalStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  ({ Login: LoginModal } = await import('component/modal-form/login/login'));
  ({ useModalStore: modalStore } = await import('store/modal-store'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function renderModal(): void {
  render(
    <MemoryRouter>
      <LoginModal />
    </MemoryRouter>,
  );
}

async function typeInto(labelText: string, value: string): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(labelText), value);
}

describe('Login modal', () => {
  it('renders nothing until the store opens it', () => {
    renderModal();
    expect(screen.queryByText('Login')).toBeNull();
  });

  it('shows a validation message only when the email is non-empty and invalid', async () => {
    modalStore.getState().openLogin();
    renderModal();

    expect(screen.queryByText('Please enter a valid email address')).toBeNull();
    await typeInto('Email', 'not-an-email');
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Email'));
    await typeInto('Email', 'a@b.c');
    expect(screen.queryByText('Please enter a valid email address')).toBeNull();
  });

  it('disables submit until email is valid and password is filled', async () => {
    modalStore.getState().openLogin();
    renderModal();

    const submit = screen.getByRole('button', { name: 'Login' });
    expect(submit).toBeDisabled();

    await typeInto('Email', 'a@b.c');
    expect(submit).toBeDisabled();

    await typeInto('Password', 'pw');
    expect(submit).toBeEnabled();
  });

  it('toggles password visibility', async () => {
    modalStore.getState().openLogin();
    renderModal();

    const password = screen.getByLabelText('Password') as HTMLInputElement;
    expect(password.type).toBe('password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password.type).toBe('text');
  });

  it('logs in credentialed, closes the modal, and resets the form', async () => {
    modalStore.getState().openLogin();
    renderModal();
    await typeInto('Email', 'a@b.c');
    await typeInto('Password', 'pw');
    fetchMock.mockResolvedValueOnce(jsonResponse({ accessToken: makeToken() }));

    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(screen.queryByText('Login')).toBeNull());
    expect(modalStore.getState().loginVisible).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(LOGIN_URL);
    expect(fetchMock.mock.calls[0]![1].credentials).toBe('include');
  });

  it('surfaces the API error message and re-enables the button on failure', async () => {
    modalStore.getState().openLogin();
    renderModal();
    await typeInto('Email', 'a@b.c');
    await typeInto('Password', 'wrong');
    fetchMock.mockResolvedValueOnce(jsonResponse('Incorrect username or password!', 400));

    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(screen.getByText('Incorrect username or password!')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();
  });

  it('reset-on-close clears fields and re-masks the password', async () => {
    modalStore.getState().openLogin();
    renderModal();
    await typeInto('Email', 'a@b.c');
    await typeInto('Password', 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' })); // unmask

    await userEvent.click(screen.getByRole('button', { name: '×' })); // close-button's accessible name is the × glyph

    expect(screen.queryByText('Login')).toBeNull();
    modalStore.getState().openLogin();
    renderModal();

    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveValue(''));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    await flushPromises();
  });
});
