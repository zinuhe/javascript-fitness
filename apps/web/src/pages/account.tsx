import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { ActivityEntry, WeightUnit } from '@fitness/contracts';
import { activityQuery, logout, meQuery, updateProfile } from '../api/queries';
import { ErrorMessage, formatDate, formatShortDate, parseDecimal } from '../components/ui';
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

      {/* Remounted when the unit or the saved weight changes, to show the new value. */}
      <FixedWeightForm
        key={`bar-${user.weightUnit}-${user.barWeightKg}`}
        field="barWeightKg"
        label="Barbell weight"
        hint="Added to the plates you type for barbell exercises."
        save="Save bar weight"
      />
      <FixedWeightForm
        key={`handle-${user.weightUnit}-${user.dumbbellHandleKg}`}
        field="dumbbellHandleKg"
        label="Heavy dumbbell handle"
        hint="One handle with its collars, added once per dumbbell to the plates you type for heavy dumbbell exercises."
        save="Save handle weight"
      />

      <Link to="/help" className="card link-card help-link">
        <strong>Help</strong>
        <span className="muted">How the 1RM chart and volume are worked out · Ayuda</span>
      </Link>

      <button type="button" className="button danger" onClick={signOut}>
        Sign out
      </button>

      <ActivityLog />
    </section>
  );
}

/**
 * A fixed weight added to the plates the user types, in their unit: the barbell's bar or
 * the heavy dumbbell's handle.
 */
function FixedWeightForm({
  field,
  label,
  hint,
  save,
}: {
  field: 'barWeightKg' | 'dumbbellHandleKg';
  label: string;
  hint: string;
  save: string;
}) {
  const { data: user } = useSuspenseQuery(meQuery);
  const queryClient = useQueryClient();
  const [value, setValue] = useState(() => weightInputValue(user[field], user.weightUnit));
  const change = useMutation({
    mutationFn: (kg: number) => updateProfile({ [field]: kg }),
    onSuccess: (profile) => queryClient.setQueryData(meQuery.queryKey, profile),
  });
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    change.mutate(toKg(parseDecimal(value), user.weightUnit));
  };

  return (
    <form className="card stack-tight" onSubmit={onSubmit}>
      <label>
        {label} ({user.weightUnit})
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]+([.,][0-9]{1,2})?"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
      </label>
      <p className="muted">
        {hint} Now {formatWeight(user[field], user.weightUnit)}.
      </p>
      <ErrorMessage error={change.error} />
      <div className="row">
        <button className="button secondary" disabled={change.isPending}>
          {change.isPending ? 'Saving…' : save}
        </button>
      </div>
    </form>
  );
}

const subjectDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/** "Added workout · Day 2 · Legs · Jul 16, 2026": the line plus the day it is about. */
const activityLine = (entry: ActivityEntry) =>
  entry.subjectAt
    ? `${entry.summary} · ${subjectDate.format(new Date(entry.subjectAt))}`
    : entry.summary;

/** The user's latest changes and where each came from (iPhone or Web), newest first. */
function ActivityLog() {
  const { data: entries } = useSuspenseQuery(activityQuery);
  return (
    <section className="card stack-tight" aria-labelledby="activity-title">
      <h2 id="activity-title">Activity</h2>
      {entries.length === 0 ? (
        <p className="muted">Nothing logged yet.</p>
      ) : (
        <ul className="activity" aria-label="Activity">
          {entries.map((entry) => (
            <li key={entry.id}>
              <span>{activityLine(entry)}</span>
              <span className="hint">
                {entry.device} · {formatDate(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
