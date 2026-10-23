import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { logout, meQuery } from '../api/queries';
import { formatShortDate } from '../components/ui';

/** Phone home for the account (the top bar only shows it on wide screens). */
export function AccountPage() {
  const { data: user } = useSuspenseQuery(meQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const signOut = async () => {
    await logout();
    queryClient.clear();
    await navigate({ to: '/login' });
  };

  return (
    <section className="stack">
      <h1>Account</h1>
      <dl className="card details">
        <div>
          <dt>Name</dt>
          <dd>{user.displayName}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>Member since</dt>
          <dd>{formatShortDate(user.createdAt)}</dd>
        </div>
      </dl>
      <button type="button" className="button danger" onClick={signOut}>
        Sign out
      </button>
    </section>
  );
}
