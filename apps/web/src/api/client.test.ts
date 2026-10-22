import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@fitness/contracts';
import { apiState, expireAccessTokens, issueTokens, seedUser } from '../test/api';
import { server } from '../test/setup';
import { ApiError, api, onSessionExpired, tokenStore } from './client';

function signIn() {
  const tokens = issueTokens(seedUser());
  tokenStore.set(tokens);
  return tokens;
}

describe('api()', () => {
  it('sends the access token and returns the JSON body', async () => {
    signIn();
    const me = await api<UserProfile>('/auth/me');
    expect(me.email).toBe('alex@example.com');
  });

  it('returns undefined for 204 responses', async () => {
    const { refreshToken } = signIn();
    await expect(
      api('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }),
    ).resolves.toBeUndefined();
  });

  it('throws an ApiError carrying the problem details', async () => {
    signIn();
    const error = await api('/exercises/missing').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: 'Exercise not found' });
  });

  it('falls back to the status text when the error body is not JSON', async () => {
    server.use(http.get('/api/broken', () => new HttpResponse('oops', { status: 502 })));

    const error = await api('/broken', { auth: false }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
  });
});

describe('token refresh', () => {
  it('refreshes once on a 401, retries the request and stores the rotated pair', async () => {
    const original = signIn();
    expireAccessTokens();

    const me = await api<UserProfile>('/auth/me');

    expect(me.displayName).toBe('Alex');
    expect(apiState.refreshCalls).toBe(1);
    const stored = tokenStore.get();
    expect(stored?.accessToken).not.toBe(original.accessToken);
    expect(stored?.refreshToken).not.toBe(original.refreshToken);
    // The old refresh token was consumed by the rotation.
    expect(apiState.hasRefreshToken(original.refreshToken)).toBe(false);
  });

  it('shares a single refresh between concurrent 401s', async () => {
    signIn();
    expireAccessTokens();

    // With rotation, two parallel refreshes would race and the second would fail.
    const results = await Promise.all([
      api<UserProfile>('/auth/me'),
      api('/exercises'),
      api('/workouts'),
    ]);

    expect(results).toHaveLength(3);
    expect(apiState.refreshCalls).toBe(1);
  });

  it('retries without refreshing again when another request already rotated the tokens', async () => {
    signIn();
    expireAccessTokens();
    // First request renews the session...
    await api('/auth/me');
    // ...then a request that was sent with the old token comes back 401 afterwards.
    const stale = issueTokens(seedUser({ email: 'stale@example.com' })).accessToken;
    const current = tokenStore.get()!;
    server.use(
      http.get('/api/exercises', ({ request }) =>
        request.headers.get('authorization') === `Bearer ${stale}`
          ? HttpResponse.json({ status: 401 }, { status: 401 })
          : HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }),
      ),
    );
    tokenStore.set({ ...current, accessToken: stale });
    const inFlight = api('/exercises');
    tokenStore.set(current); // rotation completes while the request is in flight

    await expect(inFlight).resolves.toMatchObject({ total: 0 });
    expect(apiState.refreshCalls).toBe(1);
  });

  it('signs out and notifies listeners when the refresh token is rejected', async () => {
    tokenStore.set({
      accessToken: 'stale',
      refreshToken: 'revoked',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    const error = await api('/auth/me').catch((e: unknown) => e);
    unsubscribe();

    expect((error as ApiError).status).toBe(401);
    expect(listener).toHaveBeenCalledOnce();
    expect(tokenStore.get()).toBeNull();
  });

  it('does not try to refresh anonymous requests', async () => {
    const error = await api('/auth/login', {
      method: 'POST',
      body: { email: 'nobody@example.com', password: 'x' },
      auth: false,
    }).catch((e: unknown) => e);

    expect((error as ApiError).status).toBe(401);
    expect(apiState.refreshCalls).toBe(0);
  });
});

describe('tokenStore', () => {
  it('persists tokens to localStorage and reads them back', () => {
    const tokens = signIn();
    expect(JSON.parse(localStorage.getItem('fitness.tokens') ?? 'null')).toEqual(tokens);

    tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
    expect(localStorage.getItem('fitness.tokens')).toBeNull();
  });

  it('keeps working in memory when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    const tokens = signIn();

    expect(tokenStore.get()).toEqual(tokens);
  });
});
