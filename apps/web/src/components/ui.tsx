import { Link, type ErrorComponentProps } from '@tanstack/react-router';
import type { Exercise } from '@fitness/contracts';
import { ApiError } from '../api/client';

/** `full_body` → `Full body` for enum values shown in the UI. */
export function labelize(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Barbell · Dumbbell". */
export function equipmentLabel(equipment: string[]): string {
  return equipment.map(labelize).join(' · ');
}

const sessionDateParts = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** "Sun 18 Oct 2026": a session's day in tables, with weekday and year, no commas. */
export function formatSessionDate(iso: string): string {
  const parts = sessionDateParts.formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')} ${part('day')} ${part('month')} ${part('year')}`;
}

/** Short calendar date: "Oct 20", with the year only when it isn't the current one. */
export function formatShortDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/**
 * Full day label for workout lists and titles: "Thursday, July 16, 2026", prefixed with
 * "Today · " or "Yesterday · " for the last two calendar days.
 */
export function formatDay(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const full = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return `Today · ${full}`;
  if (days === 1) return `Yesterday · ${full}`;
  return full;
}

/** Parses a typed number, accepting a decimal comma (iOS keypads in many locales). */
export const parseDecimal = (value: string) => Number(value.trim().replace(',', '.'));

export function exerciseNames(exercises: Exercise[]): Map<string, string> {
  return new Map(exercises.map((e) => [e.id, e.name]));
}

/**
 * Human message for an API/network error, including per-field validation details;
 * `describe` can reword each detail in the page's own terms.
 */
export function ErrorMessage({
  error,
  describe = (detail) => detail,
}: {
  error: unknown;
  describe?: (detail: string) => string;
}) {
  if (!error) return null;
  const details =
    error instanceof ApiError && error.problem.errors
      ? Object.values(error.problem.errors).flat().map(describe)
      : [];
  const message =
    error instanceof ApiError
      ? // The API's generic 400 title; the details below say what was wrong.
        error.message === 'Validation failed' && details.length > 0
        ? 'The server rejected some values:'
        : error.message
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

/** "Day 2 · Pull" (or just "Day 2" for an unnamed day); positions are zero-based. */
export function dayLabel(day: { position: number; name?: string }): string {
  return day.name ? `Day ${day.position + 1} · ${day.name}` : `Day ${day.position + 1}`;
}
