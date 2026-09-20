import { Link } from 'react-router';
import { selectEmail, selectRole, useAuthStore } from 'store/auth-store';
import { useT } from 'store/language-store';
import { visibleMenuItems } from 'component/shared/menu-items';
import { usePageTitle } from 'hooks/use-page-title';

// All page-level styles are global in src/scss/page.scss.
import './dashboard.scss';

/**
 * Ported from Angular's Dashboard: minimal landing page — welcome + role-filtered
 * quick links, no data fetching.
 */
export function Dashboard() {
  usePageTitle('Dashboard | Asset Manager');

  const role = useAuthStore(selectRole);
  const email = useAuthStore(selectEmail);
  const t = useT();

  // The Angular items/welcome computeds re-derive cheaply on every render.
  const items = visibleMenuItems(role);
  const welcome = email ? `Welcome, ${email}` : 'Welcome';

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('menu.dashboard')}</h1>
        <p className="page-subtitle">{welcome}</p>
      </div>

      <div className="quick-link-grid">
        {items.map((item) => (
          <Link key={item.path} className="quick-link" to={`/${item.path}`}>
            <span className="quick-link__title">{t(item.labelKey)}</span>
            <span className="quick-link__description">{item.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
