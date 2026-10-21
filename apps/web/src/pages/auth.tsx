import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, getRouteApi, useRouter } from '@tanstack/react-router';
import type { UserProfile } from '@fitness/contracts';
import { login, meQuery, register } from '../api/queries';
import { ErrorMessage } from '../components/ui';

/** After signing in, return to the page that sent us here (same-origin paths only). */
function useCompleteSignIn(redirect: string | undefined) {
  const router = useRouter();
  const queryClient = useQueryClient();
  return async (user: UserProfile) => {
    queryClient.setQueryData(meQuery.queryKey, user);
    if (redirect?.startsWith('/') && !redirect.startsWith('//')) {
      router.history.push(redirect);
    } else {
      await router.navigate({ to: '/workouts' });
    }
  };
}

const loginRoute = getRouteApi('/login');

export function LoginPage() {
  const { redirect } = loginRoute.useSearch();
  const mutation = useMutation({ mutationFn: login, onSuccess: useCompleteSignIn(redirect) });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate({ email: String(form.get('email')), password: String(form.get('password')) });
  };

  return (
    <main className="auth">
      <form className="card stack" onSubmit={onSubmit}>
        <h1>Sign in</h1>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
          />
        </label>
        <ErrorMessage error={mutation.error} />
        <button className="button" disabled={mutation.isPending}>
          {mutation.isPending ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted">
          No account yet?{' '}
          <Link to="/register" search={{ redirect }}>
            Create one
          </Link>
        </p>
      </form>
    </main>
  );
}

const registerRoute = getRouteApi('/register');

export function RegisterPage() {
  const { redirect } = registerRoute.useSearch();
  const mutation = useMutation({ mutationFn: register, onSuccess: useCompleteSignIn(redirect) });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate({
      displayName: String(form.get('displayName')),
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
  };

  return (
    <main className="auth">
      <form className="card stack" onSubmit={onSubmit}>
        <h1>Create account</h1>
        <label>
          Name
          <input name="displayName" autoComplete="name" maxLength={80} required />
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
          <span className="hint">At least 8 characters.</span>
        </label>
        <ErrorMessage error={mutation.error} />
        <button className="button" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating…' : 'Create account'}
        </button>
        <p className="muted">
          Already registered?{' '}
          <Link to="/login" search={{ redirect }}>
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
