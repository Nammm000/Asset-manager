import { RenderMode, ServerRoute } from '@angular/ssr';

// Every page is auth-gated and reads its session from localStorage — the
// server can never render them (the guard would open the login modal during
// SSR). Serve the shell and let routing run in the browser only.
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client
  }
];
