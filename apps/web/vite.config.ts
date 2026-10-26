import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Deploy version from the repo-root VERSION file (bumped by `scripts/deploy.sh`).
const versionFile = fileURLToPath(new URL('../../VERSION', import.meta.url));
process.env.VITE_APP_VERSION ??= existsSync(versionFile)
  ? readFileSync(versionFile, 'utf8').trim()
  : 'dev';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Consume the shared contracts from TS source: the package's build output is
      // CommonJS (for the Nest services) and its enums are needed at runtime here.
      '@fitness/contracts': fileURLToPath(
        new URL('../../packages/contracts/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    // Same-origin API in every environment: Vite proxies in dev, Nginx in the container.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
