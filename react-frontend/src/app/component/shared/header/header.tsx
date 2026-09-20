import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { NavLink } from 'react-router';
import { useModalStore } from 'store/modal-store';
import { selectEmail, useAuthStore } from 'store/auth-store';
import { selectIsDark, useThemeStore } from 'store/theme-store';
import { useLanguageStore, useT } from 'store/language-store';
import { useNotificationStore } from 'store/notification-store';
import { formatMediumTime } from 'util/time-util';
import type { Language } from 'i18n/translations';
import logoUrl from '../../../../assets/img/thumbs-up-icon.svg';

import './header.scss';

/**
 * Ported from Angular's Header: sticky bar with logo, theme toggle (one button
 * for guests and authenticated users, all widths), notification bell (badge,
 * dropdown, markAllRead on open), avatar dropdown (initials fallback with
 * error retry, language select, change password, logout) or guest
 * login/signup + mobile hamburger (≤404px). Bell chrome lives globally in
 * src/scss/notification.scss and the theme toggle in src/scss/theme.scss.
 *
 * The avatar hydration side effect (Angular's UserImageService injection) now
 * lives in service/user-image.ts initAvatarSync(), started from main.tsx —
 * this component just renders whatever avatarUrl holds.
 */
export function Header() {
  const openLoginModal = useModalStore((state) => state.openLogin);
  const openSignupModal = useModalStore((state) => state.openSignup);
  const openChangePasswordModal = useModalStore((state) => state.openChangePassword);

  const authenticated = useAuthStore((state) => state.isAuthenticated());
  const email = useAuthStore(selectEmail);
  const avatarUrl = useAuthStore((state) => state.avatarUrl);
  const logout = useAuthStore((state) => state.logout);

  const isDark = useThemeStore(selectIsDark);
  const toggleTheme = useThemeStore((state) => state.toggle);

  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const t = useT();

  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const notifications = useNotificationStore((state) => state.notifications);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const clearAll = useNotificationStore((state) => state.clearAll);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const headerRef = useRef<HTMLElement>(null);

  // A changed avatar URL (e.g. re-login as someone else) must retry the <img>.
  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarUrl]);

  // Outside-click and Escape close both dropdowns (the Angular HostListeners).
  useEffect(() => {
    const onDocumentClick = (event: MouseEvent): void => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setIsNotificationDropdownOpen(false);
      }
    };
    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsNotificationDropdownOpen(false);
      }
    };
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onKeydown);
    };
  }, []);

  // Null-safe: isAuthenticated() implies a sub claim whenever this renders,
  // but keep the '?' so a null email can never crash the header.
  const initials = email?.charAt(0).toUpperCase() ?? '?';
  // Null when no URL is stored or the <img> errored → initials fallback.
  const avatarSrc = avatarLoadFailed ? null : avatarUrl;
  // Badge text — capped so three digits can't overflow the 16px dot.
  const unreadLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  const toggleMobileMenu = (): void => setIsMobileMenuOpen((value) => !value);

  const toggleDropdown = (): void => {
    // Only one header dropdown at a time.
    setIsNotificationDropdownOpen(false);
    setIsDropdownOpen((value) => !value);
  };

  const closeDropdown = (): void => setIsDropdownOpen(false);

  const toggleNotifications = (): void => {
    setIsDropdownOpen(false);
    setIsNotificationDropdownOpen((value) => !value);
    // Opening the dropdown is "reading" the notifications.
    if (!isNotificationDropdownOpen) {
      markAllRead();
    }
  };

  const onAvatarError = (): void => setAvatarLoadFailed(true);

  const onLanguageChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setLanguage(event.target.value as Language);
  };

  const onChangePasswordClick = (): void => {
    closeDropdown();
    openChangePasswordModal();
  };

  const onLogoutClick = (): void => {
    closeDropdown();
    logout();
  };

  return (
    <header className="header" ref={headerRef}>
      <div className="header__logo">
        <img src={logoUrl} alt="Logo" className="header__logo-img" />
      </div>

      <div className="header__right">
        {/* Theme toggle: one button for guests and authenticated users, all widths */}
        <button
          className="header__theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          <i className={`icon-18 ${isDark ? 'sun' : 'moon'}`} aria-hidden="true" />
        </button>

        {authenticated ? (
          <>
            {/* Authenticated: bell + avatar replace the auth buttons and the hamburger at all widths */}
            <div className="header__bell-menu">
              <button
                className="header__bell-btn"
                type="button"
                onClick={toggleNotifications}
                aria-haspopup="menu"
                aria-expanded={isNotificationDropdownOpen}
                aria-label={t('notifications.title')}
              >
                <i className="icon-18 bell" aria-hidden="true" />
                {unreadCount > 0 && <span className="header__bell-badge">{unreadLabel}</span>}
              </button>

              {isNotificationDropdownOpen && (
                <nav className="header__bell-dropdown" role="menu" aria-label={t('notifications.title')}>
                  <div className="header__bell-head">
                    <span className="header__bell-title">{t('notifications.title')}</span>
                    <button className="header__bell-clear" type="button" onClick={clearAll}>
                      {t('notifications.clear')}
                    </button>
                  </div>
                  <div className="header__bell-list">
                    {notifications.map((n, index) => (
                      <div className="header__bell-item" key={index}>
                        <p className="header__bell-item-message">{n.message}</p>
                        <time className="header__bell-item-time">{formatMediumTime(n.timestamp)}</time>
                      </div>
                    ))}
                    {notifications.length === 0 && <p className="header__bell-empty">{t('notifications.empty')}</p>}
                  </div>
                </nav>
              )}
            </div>

            <div className="header__avatar-menu">
              <button
                className="header__avatar-btn"
                type="button"
                onClick={toggleDropdown}
                aria-haspopup="menu"
                aria-expanded={isDropdownOpen}
                aria-label="User menu"
              >
                {avatarSrc ? (
                  <img className="header__avatar-img" src={avatarSrc} alt="Profile avatar" onError={onAvatarError} />
                ) : (
                  <span className="header__avatar-initials">{initials}</span>
                )}
              </button>

              {isDropdownOpen && (
                <nav className="header__dropdown" role="menu" aria-label="User menu">
                  <NavLink
                    className={({ isActive }) =>
                      `header__dropdown-item header__dropdown-item--link${isActive ? ' header__dropdown-item--active' : ''}`
                    }
                    role="menuitem"
                    to="/user-setting"
                    onClick={closeDropdown}
                  >
                    {t('common.settings')}
                  </NavLink>
                  {/* Language options never close the dropdown: the relabel is the feedback. */}
                  <div className="header__dropdown-section">
                    <select
                      id="header-language"
                      className="header__dropdown-select"
                      value={language}
                      onChange={onLanguageChange}
                    >
                      <option value="vi">Tiếng Việt</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <button className="header__dropdown-item" type="button" role="menuitem" onClick={onChangePasswordClick}>
                    {t('common.changePassword')}
                  </button>
                  <button
                    className="header__dropdown-item header__dropdown-item--danger"
                    type="button"
                    role="menuitem"
                    onClick={onLogoutClick}
                  >
                    {t('common.logout')}
                  </button>
                </nav>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Desktop: Auth buttons */}
            <nav className="header__nav desktop-only">
              <button className="btn btn--login" onClick={openLoginModal}>
                Login
              </button>
              <button className="btn btn--signup" onClick={openSignupModal}>
                Sign Up
              </button>
            </nav>

            {/* Mobile: Hamburger menu */}
            <button
              className={`header__hamburger mobile-only${isMobileMenuOpen ? ' active' : ''}`}
              onClick={toggleMobileMenu}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>

            {/* Mobile menu dropdown */}
            {isMobileMenuOpen && (
              <nav className="header__mobile-menu mobile-only">
                <button className="btn btn--login" onClick={openLoginModal}>
                  Login
                </button>
                <button className="btn btn--signup" onClick={openSignupModal}>
                  Sign Up
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </header>
  );
}
