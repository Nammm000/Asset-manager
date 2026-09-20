// Global SCSS in the exact Angular import order (theme FIRST — it defines the
// tokens everything else consumes).
import './scss/theme.scss';
import './scss/modal.scss';
import './scss/table.scss';
import './scss/page.scss';
import './scss/notification.scss';
import './scss/icon.scss';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { useAuthStore } from 'store/auth-store';
import { initNotificationSync } from 'store/notification-store';
import { initAvatarSync } from 'service/user-image';
import { router } from './app/routes';

async function bootstrap(): Promise<void> {
  // Mirrors Angular's provideAppInitializer: the blind cookie-refresh settles
  // BEFORE any route/guard renders — the access token is memory-only and the
  // refresh cookie HttpOnly, so this is what restores the session across
  // reloads and lets the guards decide on settled state. A 401 resolves
  // silently (guest); restoreSession swallows every error.
  await useAuthStore.getState().restoreSession();

  // The Angular root services owned their session "effects"; here the store
  // subscriptions start once, outside React — immune to StrictMode's
  // double-invocation of render/effects.
  initNotificationSync();
  initAvatarSync();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

void bootstrap();
