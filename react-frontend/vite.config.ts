import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Preserves the Angular tsconfig convention `"*": ["src/app/*"]`: ported files keep
// their bare imports (`service/…`, `model/…`, `util/…`, `component/…`, plus the new
// `store/`, `core/`, `hooks/`, `guard/`, `i18n/`) with zero import edits.
const appDirs = ['component', 'service', 'model', 'util', 'i18n', 'store', 'core', 'hooks', 'guard'];
const alias = appDirs.map((dir) => ({
  find: new RegExp(`^${dir}/`),
  replacement: fileURLToPath(new URL(`./src/app/${dir}/`, import.meta.url)),
}));

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  // The backend's CORS + WebSocket allowed-origins are pinned to
  // app.client.url=http://localhost:4200 — the dev server must match it.
  server: { port: 4200, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
