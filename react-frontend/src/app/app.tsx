import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { useAuthStore } from 'store/auth-store';
import { Header } from 'component/shared/header/header';
import { Sidebar } from 'component/shared/sidebar/sidebar';
import { Login } from 'component/modal-form/login/login';
import { Signup } from 'component/modal-form/signup/signup';
import { ChangePassword } from 'component/modal-form/change-password/change-password';
import { Confirmation } from 'component/modal-form/confirmation/confirmation';

// Global layout chrome; the per-component chrome of these files is tiny on
// purpose (Angular's 4kB anyComponentStyle budget pushed the shared parts into
// the global src/scss/ files).
import './app.scss';

/**
 * Ported from Angular's app.html: header always; sidebar only when
 * authenticated; the routed page in the content area; and the four modals
 * permanently mounted (visibility lives in modal-store — never
 * component-to-component).
 */
export function App() {
  const authenticated = useAuthStore((state) => state.isAuthenticated());

  return (
    <>
      <Header />
      <div className="app-layout">
        {authenticated && (
          <aside className="app-layout__sidebar">
            <Sidebar />
          </aside>
        )}
        <main className="app-layout__content">
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <Login />
      <Signup />
      <ChangePassword />
      <Confirmation />
    </>
  );
}
