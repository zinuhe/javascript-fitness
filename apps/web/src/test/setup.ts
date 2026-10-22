import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { tokenStore } from '../api/client';
import { handlers, resetApi } from './api';

export const server = setupServer(...handlers);

beforeAll(() => {
  // Any request without a handler is a bug in the test or the app: fail loudly.
  server.listen({ onUnhandledFrame: 'error' });
  // jsdom doesn't implement scrolling; the router's scroll restoration calls it.
  window.scrollTo = () => undefined;
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetApi();
  tokenStore.clear();
});

afterAll(() => server.close());
