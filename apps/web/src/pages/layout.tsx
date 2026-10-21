import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { logout, meQuery } from '../api/queries';

export function AppLayout() {
  const { data: user } = useSuspenseQuery(meQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const signOut = async () => {
    await logout();
    queryClient.clear();
    await navigate({ to: '/login' });
  };

  return (
    <>
      <header className="topbar">
        <Link to="/workouts" className="brand">
          Fitness
        </Link>
        <nav>
          <Link to="/workouts" activeProps={{ className: 'active' }}>
            Workouts
          </Link>
          <Link to="/exercises" activeProps={{ className: 'active' }}>
            Exercises
          </Link>
        </nav>
        <div className="user">
          <span className="muted">{user.displayName}</span>
          <button type="button" className="button secondary small" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
