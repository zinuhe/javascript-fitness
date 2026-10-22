import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { tokenStore } from '../api/client';
import { DEFAULT_PASSWORD, apiState, seedUser } from '../test/api';
import { currentUrl, renderApp, signedInAs } from '../test/render';

describe('authentication flow', () => {
  it('sends anonymous visitors to sign in and returns them to the page they wanted', async () => {
    seedUser({ email: 'alex@example.com', displayName: 'Alex' });
    const { user, router } = renderApp('/exercises');

    await screen.findByRole('heading', { name: 'Sign in' });
    expect(currentUrl(router)).toBe('/login?redirect=%2Fexercises');

    await user.type(screen.getByLabelText('Email'), 'alex@example.com');
    await user.type(screen.getByLabelText('Password'), DEFAULT_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByRole('heading', { name: 'Exercises' });
    expect(currentUrl(router)).toBe('/exercises');
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(tokenStore.get()).not.toBeNull();
  });

  it('shows the API error on wrong credentials and stays on the form', async () => {
    seedUser();
    const { user } = renderApp('/login');

    await user.type(await screen.findByLabelText('Email'), 'alex@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(tokenStore.get()).toBeNull();
  });

  it('ignores off-site redirect targets after signing in', async () => {
    seedUser();
    const { user, router } = renderApp('/login?redirect=%2F%2Fevil.example');

    await user.type(await screen.findByLabelText('Email'), 'alex@example.com');
    await user.type(screen.getByLabelText('Password'), DEFAULT_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByRole('heading', { name: 'Workouts' });
    expect(currentUrl(router)).toBe('/workouts');
  });

  it('registers a new account and lands on the workouts page', async () => {
    const { user, router } = renderApp('/register');

    await user.type(await screen.findByLabelText('Name'), 'Sam');
    await user.type(screen.getByLabelText('Email'), 'sam@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'a-long-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await screen.findByText('No workouts logged yet.');
    expect(currentUrl(router)).toBe('/workouts');
    expect(screen.getByText('Sam')).toBeInTheDocument();
  });

  it('reports an email that is already registered', async () => {
    seedUser({ email: 'sam@example.com' });
    const { user } = renderApp('/register');

    await user.type(await screen.findByLabelText('Name'), 'Sam');
    await user.type(screen.getByLabelText('Email'), 'sam@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'a-long-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email is already registered');
  });

  it('skips the sign-in page when a session already exists', async () => {
    signedInAs();
    const { router } = renderApp('/login');

    await screen.findByRole('heading', { name: 'Workouts' });
    expect(currentUrl(router)).toBe('/workouts');
  });

  it('signs out: revokes the refresh token, clears the session and guards pages again', async () => {
    signedInAs();
    const { refreshToken } = tokenStore.get()!;
    const { user, router } = renderApp('/workouts');

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    await screen.findByRole('heading', { name: 'Sign in' });
    expect(tokenStore.get()).toBeNull();
    expect(apiState.hasRefreshToken(refreshToken)).toBe(false);

    await router.navigate({ to: '/workouts' });
    await waitFor(() => expect(currentUrl(router)).toBe('/login?redirect=%2Fworkouts'));
  });
});
