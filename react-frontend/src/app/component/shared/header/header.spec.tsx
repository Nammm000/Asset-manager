import { act, fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { flushPromises, jsonResponse, makeToken } from '../../../../test/helpers';
import type { Header as HeaderComponent } from 'component/shared/header/header';
import type { useAuthStore as AuthStore } from 'store/auth-store';
import type { useModalStore as ModalStore } from 'store/modal-store';
import type { useNotificationStore as NotificationStore } from 'store/notification-store';

// Ported from header.spec.ts: TestBed → RTL render, AuthService/ModalService →
// zustand stores (seeded with a hand-built JWT), the notification service fake
// → the real notification store driven via setState/spies (no WebSocket is ever
// started in tests — the socket lifecycle lives in initNotificationSync, which
// only main.tsx calls), HttpTestingController → stubbed global fetch.
const TOKEN_KEY = 'asset-manager.token';
const AVATAR_KEY = 'asset-manager.avatar';
const THEME_KEY = 'asset-manager.theme';
const LANGUAGE_KEY = 'asset-manager.language';
const LOGOUT_URL = 'http://localhost:8082/auth/logout';

let Header: typeof HeaderComponent;
let authStore: typeof AuthStore;
let modalStore: typeof ModalStore;
let notificationStore: typeof NotificationStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  ({ Header } = await import('component/shared/header/header'));
  ({ useAuthStore: authStore } = await import('store/auth-store'));
  ({ useModalStore: modalStore } = await import('store/modal-store'));
  ({ useNotificationStore: notificationStore } = await import('store/notification-store'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

// MemoryRouter: the dropdown's Settings entry is a NavLink.
function renderHeader(): void {
  render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
}

const themeToggle = (): HTMLElement => document.querySelector<HTMLElement>('.header__theme-toggle')!;
const avatarButton = (): HTMLElement => document.querySelector<HTMLElement>('.header__avatar-btn')!;
const bellButton = (): HTMLElement => document.querySelector<HTMLElement>('.header__bell-btn')!;

describe('Header (logged out)', () => {
  it('shows Login and Sign Up buttons and the hamburger, no avatar', () => {
    renderHeader();

    expect(document.querySelector('header.header')).not.toBeNull();
    expect(document.querySelector('.btn--login')).not.toBeNull();
    expect(document.querySelector('.btn--signup')).not.toBeNull();
    expect(document.querySelector('.header__hamburger')).not.toBeNull();
    expect(document.querySelector('.header__avatar-btn')).toBeNull();
    expect(document.querySelector('.header__dropdown')).toBeNull();
  });

  it('shows no notification bell for guests', () => {
    renderHeader();

    expect(document.querySelector('.header__bell-btn')).toBeNull();
    expect(document.querySelector('.header__bell-dropdown')).toBeNull();
  });

  it('renders the theme toggle (moon icon, switch-to-dark label) for guests', () => {
    // jsdom's matchMedia stub reports no dark preference, so the store defaults to light.
    renderHeader();

    const icon = themeToggle().querySelector('i');
    expect(themeToggle().getAttribute('aria-label')).toBe('Switch to dark theme');
    expect(icon?.classList.contains('moon')).toBe(true);
    expect(icon?.classList.contains('icon-18')).toBe(true);
  });

  it('clicking the toggle switches to dark, persists it, and flips icon and label', async () => {
    renderHeader();

    await userEvent.click(themeToggle());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(themeToggle().getAttribute('aria-label')).toBe('Switch to light theme');
    expect(themeToggle().querySelector('i')?.classList.contains('sun')).toBe(true);

    await userEvent.click(themeToggle());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(themeToggle().querySelector('i')?.classList.contains('moon')).toBe(true);
  });
});

describe('Header (logged in)', () => {
  beforeEach(() => {
    // Seed the in-memory session before the component reads it (tokens are never persisted).
    authStore.getState().applyAuthenticationResponse({ accessToken: makeToken({ sub: 'user@test.com' }) });
  });

  it('renders the bell with the bell glyph, no badge, no dropdown', () => {
    renderHeader();

    const icon = bellButton().querySelector('i');
    expect(bellButton().getAttribute('aria-label')).toBe('Notifications');
    expect(icon?.classList.contains('icon-18')).toBe(true);
    expect(icon?.classList.contains('bell')).toBe(true);
    expect(document.querySelector('.header__bell-badge')).toBeNull();
    expect(document.querySelector('.header__bell-dropdown')).toBeNull();
  });

  it('shows the unread badge, capping the label at 9+', () => {
    renderHeader();

    act(() => notificationStore.setState({ unreadCount: 10 }));
    expect(document.querySelector<HTMLElement>('.header__bell-badge')?.textContent?.trim()).toBe('9+');

    act(() => notificationStore.setState({ unreadCount: 3 }));
    expect(document.querySelector<HTMLElement>('.header__bell-badge')?.textContent?.trim()).toBe('3');

    act(() => notificationStore.setState({ unreadCount: 0 }));
    expect(document.querySelector('.header__bell-badge')).toBeNull();
  });

  it('opens the bell dropdown on click, marks all read, and lists notifications', async () => {
    // Spy before render so the component captures the spied store method
    // (the Angular spec asserted the fake's markAllRead spy the same way).
    const markAllRead = vi.spyOn(notificationStore.getState(), 'markAllRead');
    renderHeader();
    act(() =>
      notificationStore.setState({
        notifications: [{ message: 'Reminder: please review your assets.', timestamp: '2026-09-12T08:30:00Z' }],
      }),
    );

    await userEvent.click(bellButton());

    expect(document.querySelector('.header__bell-dropdown')).not.toBeNull();
    expect(bellButton().getAttribute('aria-expanded')).toBe('true');
    expect(markAllRead).toHaveBeenCalled();
    expect(notificationStore.getState().unreadCount).toBe(0);
    expect(document.querySelector('.header__bell-item-message')?.textContent?.trim()).toBe(
      'Reminder: please review your assets.',
    );
    // Only presence asserted: time formatting is locale/timezone dependent.
    expect(document.querySelector('time.header__bell-item-time')).not.toBeNull();
  });

  it('shows the empty state when no notifications exist', async () => {
    renderHeader();

    await userEvent.click(bellButton());

    expect(document.querySelector('.header__bell-empty')?.textContent?.trim()).toBe('No notifications yet');
  });

  it('clears all from the dropdown, keeping it open on the empty state', async () => {
    const clearAll = vi.spyOn(notificationStore.getState(), 'clearAll');
    renderHeader();

    await userEvent.click(bellButton());
    await userEvent.click(document.querySelector<HTMLElement>('.header__bell-clear')!);

    expect(clearAll).toHaveBeenCalled();
    expect(notificationStore.getState().notifications).toEqual([]);
    expect(document.querySelector('.header__bell-dropdown')).not.toBeNull();
  });

  it('keeps only one header dropdown open at a time', async () => {
    renderHeader();

    await userEvent.click(avatarButton());
    expect(document.querySelector('.header__dropdown')).not.toBeNull();

    await userEvent.click(bellButton());
    expect(document.querySelector('.header__dropdown')).toBeNull();
    expect(document.querySelector('.header__bell-dropdown')).not.toBeNull();

    await userEvent.click(avatarButton());
    expect(document.querySelector('.header__dropdown')).not.toBeNull();
    expect(document.querySelector('.header__bell-dropdown')).toBeNull();
  });

  it('closes the bell dropdown on Escape and outside click', async () => {
    renderHeader();

    await userEvent.click(bellButton());
    expect(document.querySelector('.header__bell-dropdown')).not.toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('.header__bell-dropdown')).toBeNull();

    await userEvent.click(bellButton());
    expect(document.querySelector('.header__bell-dropdown')).not.toBeNull();

    await userEvent.click(document.body); // outside the header element
    expect(document.querySelector('.header__bell-dropdown')).toBeNull();
  });

  it('replaces buttons and hamburger with the avatar showing the email initial', () => {
    renderHeader();

    const initials = document.querySelector<HTMLElement>('.header__avatar-initials');
    expect(document.querySelector('.header__avatar-btn')).not.toBeNull();
    expect(initials?.textContent).toBe('U');
    expect(document.querySelector('img.header__avatar-img')).toBeNull();
    expect(document.querySelector('.btn--login')).toBeNull();
    expect(document.querySelector('.btn--signup')).toBeNull();
    expect(document.querySelector('.header__hamburger')).toBeNull();
  });

  it('renders the theme toggle alongside the avatar', () => {
    renderHeader();

    expect(document.querySelector('.header__theme-toggle')).not.toBeNull();
    expect(document.querySelector('.header__avatar-btn')).not.toBeNull();
  });

  it('renders the stored avatar image instead of the initials', () => {
    renderHeader();
    act(() => authStore.getState().setAvatarUrl('https://example.com/me.png'));

    const img = document.querySelector<HTMLImageElement>('img.header__avatar-img');
    expect(img?.src).toBe('https://example.com/me.png');
    expect(document.querySelector('.header__avatar-initials')).toBeNull();
  });

  it('falls back to initials when the avatar image fails to load', () => {
    renderHeader();
    act(() => authStore.getState().setAvatarUrl('https://example.com/me.png'));
    // The Angular spec called component.onAvatarError(); here the same handler
    // is driven by the DOM error event on the <img>.
    fireEvent.error(document.querySelector<HTMLImageElement>('img.header__avatar-img')!);

    expect(document.querySelector('img.header__avatar-img')).toBeNull();
    expect(document.querySelector<HTMLElement>('.header__avatar-initials')?.textContent).toBe('U');
  });

  it('opens the dropdown on avatar click and closes it on Escape / outside click', async () => {
    renderHeader();

    await userEvent.click(avatarButton());
    expect(document.querySelector('.header__dropdown')).not.toBeNull();
    expect(avatarButton().getAttribute('aria-expanded')).toBe('true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('.header__dropdown')).toBeNull();

    await userEvent.click(avatarButton());
    expect(document.querySelector('.header__dropdown')).not.toBeNull();

    await userEvent.click(document.body); // outside the header element
    expect(document.querySelector('.header__dropdown')).toBeNull();
  });

  it('opens the change-password modal from the dropdown', async () => {
    renderHeader();
    await userEvent.click(avatarButton());

    // The dropdown has more than one non-danger item (Settings link first) —
    // target the change-password entry by its label.
    const item = Array.from(document.querySelectorAll<HTMLElement>('.header__dropdown-item')).find(
      (el) => el.textContent?.trim() === 'Change Password',
    )!;
    await userEvent.click(item);

    expect(modalStore.getState().changePasswordVisible).toBe(true);
    expect(document.querySelector('.header__dropdown')).toBeNull();
  });

  // Adaptation: the Angular spec also asserted a <label class="header__dropdown-label">
  // ('Language' / 'Ngôn ngữ') — but the label is commented out in the Angular
  // template and the React port renders none either (only the select), so those
  // assertions are deliberately not ported.
  it('renders the language select with both options', async () => {
    renderHeader();
    await userEvent.click(avatarButton());

    const select = document.querySelector<HTMLSelectElement>('.header__dropdown-select')!;
    const options = Array.from(select.options);

    expect(select.id).toBe('header-language');
    expect(options.map((option) => option.textContent?.trim())).toEqual(['Tiếng Việt', 'English']);
    expect(options.map((option) => option.value)).toEqual(['vi', 'en']);
    // English is the default.
    expect(select.value).toBe('en');
  });

  it('switching to Vietnamese persists, relabels the menu live, and keeps the dropdown open', async () => {
    renderHeader();
    await userEvent.click(avatarButton());
    const select = document.querySelector<HTMLSelectElement>('.header__dropdown-select')!;

    await userEvent.selectOptions(select, 'vi');

    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('vi');
    expect(document.documentElement.getAttribute('lang')).toBe('vi');
    // The dropdown stays open so the relabel is visible.
    expect(document.querySelector('.header__dropdown')).not.toBeNull();
    const labels = Array.from(document.querySelectorAll<HTMLElement>('.header__dropdown-item')).map(
      (item) => item.textContent?.trim(),
    );
    expect(labels).toContain('Cài đặt');
    expect(labels).toContain('Đổi mật khẩu');
    expect(labels).toContain('Đăng xuất');
    // The select follows.
    expect(select.value).toBe('vi');
  });

  it('logs out from the dropdown, flips back to buttons, and keeps the avatar key', async () => {
    localStorage.setItem(AVATAR_KEY, 'https://example.com/me.png');
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Bye' }));
    renderHeader();

    await userEvent.click(avatarButton());
    await userEvent.click(document.querySelector<HTMLElement>('.header__dropdown-item--danger')!);

    await waitFor(() => expect(document.querySelector('.btn--login')).not.toBeNull());
    expect(document.querySelector('.header__avatar-btn')).toBeNull();
    // No body: the HttpOnly cookie identifies the token; the request is credentialed.
    // (rawRequest maps a null body to fetch's `body: undefined`.)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(LOGOUT_URL);
    expect(fetchMock.mock.calls[0]![1].body).toBeUndefined();
    expect(fetchMock.mock.calls[0]![1].credentials).toBe('include');
    // Tokens were never persisted, and the avatar deliberately survives logout.
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(AVATAR_KEY)).toBe('https://example.com/me.png');
    await flushPromises(); // settle the fire-and-forget logout request
  });
});
