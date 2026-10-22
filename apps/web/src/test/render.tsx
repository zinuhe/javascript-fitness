import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { tokenStore } from '../api/client';
import { createAppRouter } from '../router';
import { issueTokens, seedUser } from './api';

/** Renders the whole app (router + Query) starting at `path`, like a fresh page load. */
export function renderApp(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createAppRouter(queryClient, history);
  const user = userEvent.setup();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { user, router, queryClient };
}

/** Seeds a user and stores a valid session for them, as if they had already signed in. */
export function signedInAs(over: Parameters<typeof seedUser>[0] = {}) {
  const account = seedUser(over);
  tokenStore.set(issueTokens(account));
  return account;
}

/** Current pathname + search of the app's router. */
export const currentUrl = (router: ReturnType<typeof createAppRouter>) =>
  router.state.location.href;
