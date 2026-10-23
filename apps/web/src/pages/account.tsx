import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { WeightUnit } from '@fitness/contracts';
import { logout, meQuery, updateProfile } from '../api/queries';
import { ErrorMessage, formatShortDate } from '../components/ui';

const UNITS: { value: WeightUnit; label: string }[] = [
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'lb', label: 'Pounds (lb)' },
];

/** Phone home for the account (the top bar only shows it on wide screens). */
export function AccountPage() {
  const { data: user } = useSuspenseQuery(meQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const changeUnit = useMutation({
    mutationFn: (weightUnit: WeightUnit) => updateProfile({ weightUnit }),
    // Every weight on screen is derived from the profile, so this switches the whole app.
    onSuccess: (profile) => queryClient.setQueryData(meQuery.queryKey, profile),
  });

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

      <fieldset className="card stack-tight">
        <legend className="legend">Weight unit</legend>
        <p className="muted">Weights are shown and typed in this unit, on every device.</p>
        <div className="segmented">
          {UNITS.map(({ value, label }) => (
            <label key={value}>
              <input
                type="radio"
                name="weightUnit"
                value={value}
                checked={user.weightUnit === value}
                disabled={changeUnit.isPending}
                onChange={() => changeUnit.mutate(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <ErrorMessage error={changeUnit.error} />
      </fieldset>

      <button type="button" className="button danger" onClick={signOut}>
        Sign out
      </button>
    </section>
  );
}
