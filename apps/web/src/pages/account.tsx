import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { WeightUnit } from '@fitness/contracts';
import { logout, meQuery, updateProfile } from '../api/queries';
import { ErrorMessage, formatShortDate, parseDecimal } from '../components/ui';
import { formatWeight, toKg, weightInputValue } from '../components/units';

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

      {/* Remounted when the unit or the saved bar changes, to show the new value. */}
      <BarWeightForm key={`${user.weightUnit}-${user.barWeightKg}`} />

      <button type="button" className="button danger" onClick={signOut}>
        Sign out
      </button>
    </section>
  );
}

/** The user's barbell weight, in their unit; barbell exercises add it to the plates. */
function BarWeightForm() {
  const { data: user } = useSuspenseQuery(meQuery);
  const queryClient = useQueryClient();
  const [bar, setBar] = useState(() => weightInputValue(user.barWeightKg, user.weightUnit));
  const changeBar = useMutation({
    mutationFn: (barWeightKg: number) => updateProfile({ barWeightKg }),
    onSuccess: (profile) => queryClient.setQueryData(meQuery.queryKey, profile),
  });
  const saveBar = (event: FormEvent) => {
    event.preventDefault();
    changeBar.mutate(toKg(parseDecimal(bar), user.weightUnit));
  };

  return (
    <form className="card stack-tight" onSubmit={saveBar}>
      <label>
        Barbell weight ({user.weightUnit})
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]+([.,][0-9]{1,2})?"
          autoComplete="off"
          value={bar}
          onChange={(e) => setBar(e.target.value)}
          required
        />
      </label>
      <p className="muted">
        Added to the plates you type for barbell exercises. Now{' '}
        {formatWeight(user.barWeightKg, user.weightUnit)}.
      </p>
      <ErrorMessage error={changeBar.error} />
      <div className="row">
        <button className="button secondary" disabled={changeBar.isPending}>
          {changeBar.isPending ? 'Saving…' : 'Save bar weight'}
        </button>
      </div>
    </form>
  );
}
