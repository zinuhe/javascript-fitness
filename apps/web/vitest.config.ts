import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Reuses the app's Vite config (React plugin, @fitness/contracts alias) so tests resolve
// modules exactly like the dev server and the production build.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}', 'src/main.tsx'],
      },
    },
  }),
);
