import { Link, type ErrorComponentProps } from '@tanstack/react-router';
import type { Exercise, WorkoutSet } from '@fitness/contracts';
import { ApiError } from '../api/client';

/** `full_body` → `Full body` for enum values shown in the UI. */
export function labelize(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
export const formatKg = (value: number) => `${numberFormat.format(value)} kg`;

export const setsVolume = (sets: WorkoutSet[]) =>
  sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0);

export function exerciseNames(exercises: Exercise[]): Map<string, string> {
  return new Map(exercises.map((e) => [e.id, e.name]));
}

/** Human message for an API/network error, including per-field validation details. */
export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  const details =
    error instanceof ApiError && error.problem.errors
      ? Object.values(error.problem.errors).flat()
      : [];
  const message =
    error instanceof ApiError
      ? error.message
      : 'Could not reach the server. Check that the API is running.';
  return (
    <div className="alert" role="alert">
      <p>{message}</p>
      {details.length > 0 && (
        <ul>
          {details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ErrorView({ error, reset }: ErrorComponentProps) {
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <section className="page">
      <h1>{notFound ? 'Not found' : 'Something went wrong'}</h1>
      <ErrorMessage error={error} />
      <div className="row">
        <button type="button" className="button secondary" onClick={reset}>
          Try again
        </button>
        <Link to="/workouts" className="button secondary">
          Back to workouts
        </Link>
      </div>
    </section>
  );
}

export function NotFound() {
  return (
    <section className="page">
      <h1>Page not found</h1>
      <Link to="/workouts">Back to workouts</Link>
    </section>
  );
}

export function Pending() {
  return <p className="muted pending">Loading…</p>;
}
