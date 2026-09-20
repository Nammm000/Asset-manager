import { fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { makeToken } from '../../../../test/helpers';
import type { Sidebar as SidebarComponent } from 'component/shared/sidebar/sidebar';
import type { useAuthStore as AuthStore } from 'store/auth-store';
import type { JwtClaims } from 'util/jwt-util';

// Ported from sidebar.spec.ts: TestBed + provideRouter → RTL render inside a
// MemoryRouter (NavLinks), AuthService → auth-store seeded with a hand-built
// JWT. The mobile-drawer describe is new — the drawer shipped in both apps'
// templates but the Angular spec never covered it.
let Sidebar: typeof SidebarComponent;
let authStore: typeof AuthStore;

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  ({ Sidebar } = await import('component/shared/sidebar/sidebar'));
  ({ useAuthStore: authStore } = await import('store/auth-store'));
});

afterEach(() => {
  localStorage.clear();
});

// Seed the in-memory session before the component reads it (tokens are never persisted).
async function createSidebar(claims: Partial<JwtClaims> = {}): Promise<void> {
  authStore.getState().applyAuthenticationResponse({ accessToken: makeToken(claims) });
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  );
}

function linkLabels(): (string | undefined)[] {
  return Array.from(document.querySelectorAll('.sidebar__link')).map((a) => a.textContent?.trim());
}

describe('Sidebar', () => {
  it('shows the five non-admin items for ROLE_USER', async () => {
    await createSidebar({ role: 'ROLE_USER' });

    expect(linkLabels()).toEqual(['Dashboard', 'Savings Passbooks', 'Land Assets', 'Cash Assets', 'Other Assets']);
  });

  it('shows the five non-admin items for ROLE_CUSTOMER too', async () => {
    await createSidebar({ role: 'ROLE_CUSTOMER' });

    expect(linkLabels()).toHaveLength(5);
    expect(linkLabels()).not.toContain('Currencies');
  });

  it('adds the two admin items for ROLE_ADMIN', async () => {
    await createSidebar({ role: 'ROLE_ADMIN' });

    expect(linkLabels()).toEqual([
      'Dashboard',
      'Savings Passbooks',
      'Land Assets',
      'Cash Assets',
      'Other Assets',
      'Currencies',
      'Users',
    ]);
  });

  it('links each item to its route path', async () => {
    await createSidebar({ role: 'ROLE_USER' });

    const first = document.querySelector<HTMLAnchorElement>('.sidebar__link')!;
    expect(first.getAttribute('href')).toBe('/dashboard');
  });

  it('renders an icon glyph inside each link', async () => {
    await createSidebar({ role: 'ROLE_USER' });

    const icons = Array.from(document.querySelectorAll<HTMLElement>('.sidebar__link i.icon-18'));
    expect(icons).toHaveLength(5);
    for (const icon of icons) {
      const classNames = icon.className.split(/\s+/);
      expect(classNames).toHaveLength(2);
      expect(classNames).toContain('icon-18');
    }
  });

  describe('collapse toggle', () => {
    it('is a button at the bottom of the nav with a left chevron while expanded', async () => {
      await createSidebar({ role: 'ROLE_USER' });

      const nav = document.querySelector('nav.sidebar')!;
      const toggle = nav.querySelector<HTMLButtonElement>('.sidebar__toggle')!;
      expect(nav.lastElementChild).toBe(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(toggle.querySelector('i')!.className).toContain('chevron-left');
    });

    it('hides the labels when clicked and restores them on the next click', async () => {
      await createSidebar({ role: 'ROLE_USER' });

      const nav = document.querySelector('nav.sidebar')!;
      const toggle = nav.querySelector<HTMLButtonElement>('.sidebar__toggle')!;
      expect(nav.classList).not.toContain('sidebar--collapsed');
      expect(document.querySelectorAll('.sidebar__label')).toHaveLength(5);

      await userEvent.click(toggle);
      expect(nav.classList).toContain('sidebar--collapsed');
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(toggle.getAttribute('aria-label')).toBe('Expand navigation');
      expect(toggle.querySelector('i')!.className).toContain('chevron-right');
      // labels stay in the DOM — CSS hides them in icons-only mode
      expect(document.querySelectorAll('.sidebar__label')).toHaveLength(5);

      await userEvent.click(toggle);
      expect(nav.classList).not.toContain('sidebar--collapsed');
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(toggle.querySelector('i')!.className).toContain('chevron-left');
    });
  });

  describe('mobile drawer', () => {
    it('opens the drawer nav with a backdrop from the hamburger and closes on backdrop click', async () => {
      await createSidebar({ role: 'ROLE_USER' });

      const hamburger = document.querySelector<HTMLButtonElement>('.sidebar__hamburger')!;
      const nav = document.querySelector('nav.sidebar')!;
      expect(hamburger.getAttribute('aria-expanded')).toBe('false');

      await userEvent.click(hamburger);
      expect(nav.classList).toContain('sidebar--open');
      expect(hamburger.getAttribute('aria-expanded')).toBe('true');
      const backdrop = document.querySelector<HTMLElement>('.sidebar__backdrop');
      expect(backdrop).not.toBeNull();

      await userEvent.click(backdrop!);
      expect(nav.classList).not.toContain('sidebar--open');
      expect(document.querySelector('.sidebar__backdrop')).toBeNull();
    });

    it('closes the drawer on Escape', async () => {
      await createSidebar({ role: 'ROLE_USER' });

      await userEvent.click(document.querySelector<HTMLButtonElement>('.sidebar__hamburger')!);
      expect(document.querySelector('nav.sidebar')!.classList).toContain('sidebar--open');

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(document.querySelector('nav.sidebar')!.classList).not.toContain('sidebar--open');
    });
  });
});
