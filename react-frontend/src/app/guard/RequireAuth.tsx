import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from 'store/auth-store';
import { useModalStore } from 'store/modal-store';

/**
 * Ported from Angular's authGuard (roles via route.data.roles). Denial opens
 * the login modal instead of redirecting — there is no /login route; the modal
 * lands on top of the current view, which renders nothing until login.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const authenticated = useAuthStore((state) => state.isAuthenticated());
  const openLogin = useModalStore((state) => state.openLogin);

  useEffect(() => {
    if (!authenticated) {
      openLogin();
    }
  }, [authenticated, openLogin]);

  if (!authenticated) {
    return null;
  }
  return <>{children}</>;
}
