import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from 'store/auth-store';
import { useModalStore } from 'store/modal-store';

/**
 * Ported from Angular's adminGuard: unauthenticated → login modal (no /login
 * route); authenticated-but-forbidden → silent block (no modal).
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const authenticated = useAuthStore((state) => state.isAuthenticated());
  const isAdmin = useAuthStore((state) => state.claims?.role === 'ROLE_ADMIN');
  const openLogin = useModalStore((state) => state.openLogin);

  useEffect(() => {
    if (!authenticated) {
      openLogin();
    }
  }, [authenticated, openLogin]);

  if (!authenticated || !isAdmin) {
    return null;
  }
  return <>{children}</>;
}
