import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { selectRole, useAuthStore } from 'store/auth-store';
import { useT } from 'store/language-store';
import { visibleMenuItems } from 'component/shared/menu-items';

import './sidebar.scss';

/**
 * Ported from Angular's Sidebar: role-gated nav (visibleMenuItems filters
 * admin items), an icons-only collapsed rail on desktop, and a mobile drawer
 * (≤640px, CSS-gated) that Escape or backdrop-click closes.
 */
export function Sidebar() {
  const role = useAuthStore(selectRole);
  const t = useT();

  const items = visibleMenuItems(role);

  /** Icons-only mode: labels are hidden until the arrow is clicked again. */
  const [collapsed, setCollapsed] = useState(false);
  const toggleCollapsed = (): void => setCollapsed((value) => !value);

  /**
   * Mobile drawer (≤640px only — the CSS gates it): the nav slides in as a
   * fixed overlay below the header. Desktop ignores this state entirely.
   */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleDrawer = (): void => setDrawerOpen((value) => !value);
  const closeDrawer = (): void => setDrawerOpen(false);

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeDrawer();
      }
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, []);

  return (
    <>
      {/* Mobile hamburger row (CSS shows it only at ≤640px): opens the drawer nav */}
      <button type="button" className="sidebar__hamburger" onClick={toggleDrawer} aria-expanded={drawerOpen}>
        <i className="icon-18 menu" aria-hidden="true" />
        <span>{t('common.navigation')}</span>
      </button>
      <nav
        className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}${drawerOpen ? ' sidebar--open' : ''}`}
        aria-label={t('common.navigation')}
      >
        {items.map((item) => (
          <NavLink
            key={item.path}
            className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
            to={`/${item.path}`}
            end // routerLinkActiveOptions exact
            title={t(item.labelKey)}
            onClick={closeDrawer}
          >
            <i className={`icon-18 ${item.icon}`} aria-hidden="true" />
            <span className="sidebar__label">{t(item.labelKey)}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className="sidebar__toggle"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <i className={`icon-18 ${collapsed ? 'chevron-right' : 'chevron-left'}`} aria-hidden="true" />
        </button>
      </nav>
      {drawerOpen && <div className="sidebar__backdrop" onClick={closeDrawer} />}
    </>
  );
}
