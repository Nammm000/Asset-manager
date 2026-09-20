import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { makeToken } from '../../test/helpers';
import type { useAuthStore as AuthStore } from 'store/auth-store';
import type { useModalStore as ModalStore } from 'store/modal-store';
import type { RequireAuth } from 'guard/RequireAuth';
import type { RequireAdmin } from 'guard/RequireAdmin';

// Ported from route-guard.service.spec.ts: guards render null on denial and
// open the login modal (there is no /login route); role-forbidden is silent.
let authStore: typeof AuthStore;
let modalStore: typeof ModalStore;
let AuthGuard: typeof RequireAuth;
let AdminGuard: typeof RequireAdmin;

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  ({ useAuthStore: authStore } = await import('store/auth-store'));
  ({ useModalStore: modalStore } = await import('store/modal-store'));
  ({ RequireAuth: AuthGuard } = await import('guard/RequireAuth'));
  ({ RequireAdmin: AdminGuard } = await import('guard/RequireAdmin'));
});

afterEach(() => {
  localStorage.clear();
});

function seed(claims: { sub?: string; role?: string } = {}): void {
  authStore.getState().applyAuthenticationResponse({
    accessToken: makeToken({ sub: claims.sub ?? 'a@b.c', role: (claims.role ?? 'ROLE_USER') as never }),
  });
}

describe('RequireAuth', () => {
  it('renders nothing for a guest and opens the login modal', () => {
    render(<AuthGuard>secret</AuthGuard>);

    expect(screen.queryByText('secret')).toBeNull();
    expect(modalStore.getState().loginVisible).toBe(true);
  });

  it('renders children for an authenticated user without touching the modal', () => {
    seed();
    render(<AuthGuard>secret</AuthGuard>);

    expect(screen.getByText('secret')).toBeInTheDocument();
    expect(modalStore.getState().loginVisible).toBe(false);
  });
});

describe('RequireAdmin', () => {
  it('renders nothing and opens the login modal for a guest', () => {
    render(<AdminGuard>admin-only</AdminGuard>);

    expect(screen.queryByText('admin-only')).toBeNull();
    expect(modalStore.getState().loginVisible).toBe(true);
  });

  it('silently blocks a non-admin (no modal — they are authenticated, just forbidden)', () => {
    seed({ role: 'ROLE_USER' });
    render(<AdminGuard>admin-only</AdminGuard>);

    expect(screen.queryByText('admin-only')).toBeNull();
    expect(modalStore.getState().loginVisible).toBe(false);
  });

  it('renders children for an admin', () => {
    seed({ role: 'ROLE_ADMIN' });
    render(<AdminGuard>admin-only</AdminGuard>);

    expect(screen.getByText('admin-only')).toBeInTheDocument();
  });
});
