import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { logout, meQuery } from '../api/queries';
import { DumbbellIcon, ListIcon, PlusIcon, RepeatIcon, UserIcon } from '../components/icons';

/** Form pages get the full screen: their own sticky Save bar replaces the tab bar. */
const isFormPath = (pathname: string) =>
  /^\/(workouts|routines)\/(new|[^/]+\/edit)\/?$/.test(pathname);

export function AppLayout() {
  const { data: user } = useSuspenseQuery(meQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const showTabBar = !isFormPath(pathname);

  const signOut = async () => {
    await logout();
    queryClient.clear();
    await navigate({ to: '/login' });
  };

  return (
    <div className={showTabBar ? 'shell with-tabbar' : 'shell'}>
      <header className="topbar">
        <Link to="/workouts" className="brand">
          Fitness
        </Link>
        {/* Desktop navigation; on phones the bottom tab bar takes over. */}
        <nav className="topnav" aria-label="Main">
          <Link to="/workouts" activeProps={{ className: 'active' }}>
            Workouts
          </Link>
          <Link to="/routines" activeProps={{ className: 'active' }}>
            Routines
          </Link>
          <Link to="/exercises" activeProps={{ className: 'active' }}>
            Exercises
          </Link>
        </nav>
        {/* Wide screens only; on phones this lives in the Account tab. */}
        <div className="user">
          <span className="muted user-name">{user.displayName}</span>
          <button type="button" className="button secondary small" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
      {showTabBar && (
        <nav className="tabbar" aria-label="Tabs">
          <Link to="/workouts" activeProps={{ className: 'active' }}>
            <ListIcon />
            <span>Workouts</span>
          </Link>
          <Link to="/routines" activeProps={{ className: 'active' }}>
            <RepeatIcon />
            <span>Routines</span>
          </Link>
          <Link to="/workouts/start" className="tab-primary" aria-label="Log workout">
            <PlusIcon />
          </Link>
          <Link to="/exercises" activeProps={{ className: 'active' }}>
            <DumbbellIcon />
            <span>Exercises</span>
          </Link>
          <Link to="/account" activeProps={{ className: 'active' }}>
            <UserIcon />
            <span>Account</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
