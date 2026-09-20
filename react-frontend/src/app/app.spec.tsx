import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';
import { makeToken } from '../test/helpers';
import type { App as AppShellComponent } from './app';
import type { useAuthStore as AuthStore } from 'store/auth-store';
import type { useModalStore as ModalStore } from 'store/modal-store';

// Ported from app.spec.ts. The Angular spec asserted the shell by tag selector
// (app-header / app-login / app-signup elements exist in the DOM); React has no
// wrapper elements and the modals render null until the modal store opens
// them, so the same intent is ported as: the header renders, the sidebar
// appears only when authenticated, and the four permanently-mounted modals
// respond to the store (opening them is the proof they are mounted).
let AppShell: typeof AppShellComponent;
let authStore: typeof AuthStore;
let modalStore: typeof ModalStore;

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  ({ App: AppShell } = await import('./app'));
  ({ useAuthStore: authStore } = await import('store/auth-store'));
  ({ useModalStore: modalStore } = await import('store/modal-store'));
});

afterEach(() => {
  localStorage.clear();
});

// The routed page is stubbed — the Angular spec also rendered the shell with
// empty routes, and the real routes lazy-load page components covered by their
// own specs (and not all ported yet).
function renderApp(): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<div>page-stub</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('renders the shell: header and the routed page, no sidebar for a guest', () => {
    renderApp();

    expect(document.querySelector('header.header')).not.toBeNull();
    expect(screen.getByText('page-stub')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(document.querySelector('nav.sidebar')).toBeNull();
  });

  it('adds the sidebar when authenticated', () => {
    authStore.getState().applyAuthenticationResponse({ accessToken: makeToken({ sub: 'user@test.com' }) });
    renderApp();

    expect(document.querySelector('nav.sidebar')).not.toBeNull();
    expect(document.querySelector('.header__avatar-btn')).not.toBeNull();
  });

  it('mounts the four modals, opened through the modal store', () => {
    renderApp();

    act(() => modalStore.getState().openLogin());
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
    act(() => modalStore.getState().closeLogin());

    act(() => modalStore.getState().openSignup());
    expect(screen.getByRole('heading', { name: 'Sign Up' })).toBeInTheDocument();
    act(() => modalStore.getState().closeSignup());

    act(() => modalStore.getState().openChangePassword());
    expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument();
    act(() => modalStore.getState().closeChangePassword());

    act(() => modalStore.getState().openConfirmation({ title: 'Confirm?', message: 'm', onConfirm: vi.fn() }));
    expect(screen.getByRole('alertdialog', { name: 'Confirm?' })).toBeInTheDocument();
  });
});
