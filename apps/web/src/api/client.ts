import type { AuthResponse, AuthTokens, ProblemDetails } from '@fitness/contracts';

const TOKENS_KEY = 'fitness.tokens';

/** Error thrown for any non-2xx response, carrying the RFC 7807 body from the API. */
export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
  }

  get status(): number {
    return this.problem.status;
  }
}

// ── Token storage ───────────────────────────────────────────────────────────────
// Kept in localStorage so a reload stays signed in. Storage can throw (private mode,
// blocked site data), in which case the session simply lives until the tab closes.
let memoryTokens: AuthTokens | null = null;

export const tokenStore = {
  get(): AuthTokens | null {
    if (memoryTokens) return memoryTokens;
    try {
      const raw = localStorage.getItem(TOKENS_KEY);
      memoryTokens = raw ? (JSON.parse(raw) as AuthTokens) : null;
    } catch {
      memoryTokens = null;
    }
    return memoryTokens;
  },
  set(tokens: AuthTokens): void {
    memoryTokens = tokens;
    try {
      localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    } catch {
      // ignore — see note above
    }
  },
  clear(): void {
    memoryTokens = null;
    try {
      localStorage.removeItem(TOKENS_KEY);
    } catch {
      // ignore
    }
  },
};

/** Listeners notified when the session can no longer be refreshed (forced sign-out). */
const sessionExpiredListeners = new Set<() => void>();
export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

// ── Requests ────────────────────────────────────────────────────────────────────
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Attach the access token and transparently refresh it once on a 401. */
  auth?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true } = options;
  const sentWith = tokenStore.get()?.accessToken;
  let response = await send(path, options);

  if (response.status === 401 && auth && tokenStore.get()) {
    // If another request already rotated the tokens while this one was in flight, just
    // retry with the new access token instead of burning another refresh.
    const rotatedMeanwhile = tokenStore.get()?.accessToken !== sentWith;
    const refreshed = rotatedMeanwhile || (await refreshTokens());
    if (refreshed) {
      response = await send(path, options);
    }
  }

  if (!response.ok) {
    throw new ApiError(await readProblem(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function send(path: string, { method = 'GET', body, auth = true }: RequestOptions) {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const tokens = auth ? tokenStore.get() : null;
  if (tokens) headers.authorization = `Bearer ${tokens.accessToken}`;

  return fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function readProblem(response: Response): Promise<ProblemDetails> {
  try {
    return (await response.json()) as ProblemDetails;
  } catch {
    return { type: 'about:blank', title: response.statusText, status: response.status };
  }
}

// Concurrent 401s share one refresh: the API rotates refresh tokens, so a second
// parallel refresh with the same (now revoked) token would fail and sign the user out.
let refreshInFlight: Promise<boolean> | null = null;

function refreshTokens(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    const current = tokenStore.get();
    if (!current) return false;
    try {
      const response = await send('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: current.refreshToken },
        auth: false,
      });
      if (!response.ok) throw new Error('refresh failed');
      const result = (await response.json()) as AuthResponse;
      tokenStore.set(result.tokens);
      return true;
    } catch {
      tokenStore.clear();
      sessionExpiredListeners.forEach((listener) => listener());
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}
