import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { makeToken } from '../../../test/helpers';
import type { Dashboard as DashboardComponent } from 'component/dashboard/dashboard';
import type { useAuthStore as AuthStore } from 'store/auth-store';

// Ported from dashboard.spec.ts: TestBed + a seeded AuthService becomes an RTL
// render inside MemoryRouter (the quick links are <Link>s) with the auth store
// seeded before mount. The dashboard fetches nothing, so no fetch stub is
// needed — only a fresh module graph per test.
let Dashboard: typeof DashboardComponent;
let authStore: typeof AuthStore;

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  ({ useAuthStore: authStore } = await import('store/auth-store'));
  ({ Dashboard } = await import('component/dashboard/dashboard'));
});

afterEach(() => {
  localStorage.clear();
});

/** Seeds the in-memory session before the component reads it (tokens are never persisted). */
function seed(claims: { sub?: string; role?: string } = {}): void {
  authStore.getState().applyAuthenticationResponse({
    accessToken: makeToken({
      sub: claims.sub ?? 'user@test.com',
      role: (claims.role ?? 'ROLE_USER') as never,
    }),
  });
}

function quickLinkTitles(): (string | null)[] {
  return Array.from(document.querySelectorAll('.quick-link__title')).map(
    (el) => el.textContent?.trim() ?? null,
  );
}

describe('Dashboard', () => {
  it('greets the signed-in user by email', () => {
    seed({ sub: 'owner@test.com' });
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('Welcome, owner@test.com')).toBeInTheDocument();
  });

  it('shows the five non-admin quick links for ROLE_USER', () => {
    seed({ role: 'ROLE_USER' });
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(quickLinkTitles()).toEqual([
      'Dashboard',
      'Savings Passbooks',
      'Land Assets',
      'Cash Assets',
      'Other Assets',
    ]);
  });

  it('shows all seven quick links for ROLE_ADMIN', () => {
    seed({ role: 'ROLE_ADMIN' });
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(quickLinkTitles()).toHaveLength(7);
    expect(quickLinkTitles()).toContain('Currencies');
    expect(quickLinkTitles()).toContain('Users');
  });
});
