import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { NextRoutineDay } from '@fitness/contracts';
import { exercisesQuery, nextRoutineQuery } from '../api/queries';
import { dayLabel, exerciseNames } from '../components/ui';

/** "Next up" call to action for the active routine (Workouts list and Start page). */
export function NextUpCard({ next }: { next: NextRoutineDay }) {
  const { data: catalog } = useSuspenseQuery(exercisesQuery);
  const names = exerciseNames(catalog.items);
  return (
    <Link
      to="/workouts/new"
      search={{ routineDayId: next.day.id }}
      className="card link-card next-up"
      aria-label={`Start ${dayLabel(next.day)} of ${next.routine.name}`}
    >
      <span className="next-up-kicker">Next up · {next.routine.name}</span>
      <strong className="next-up-title">{dayLabel(next.day)}</strong>
      <span className="muted">
        {next.day.exerciseIds.map((id) => names.get(id) ?? 'Unknown exercise').join(' · ')}
      </span>
      <span className="button next-up-cta">Start</span>
    </Link>
  );
}

/**
 * What the tab bar's + opens when a routine is active: the next day first, then any other
 * day of the routine, or an empty workout. (Without an active routine the route redirects
 * straight to the empty form.)
 */
export function StartWorkoutPage() {
  const { data: next } = useSuspenseQuery(nextRoutineQuery);
  if (!next) return null; // the route redirects before rendering in this case

  const others = next.routine.days.filter((day) => day.id !== next.day.id);
  return (
    <section className="stack">
      <h1>Start workout</h1>
      <NextUpCard next={next} />

      {others.length > 0 && (
        <div className="stack-tight">
          <h2>Other days</h2>
          <ul className="card list-rows" aria-label="Other days">
            {others.map((day) => (
              <li key={day.id}>
                <Link to="/workouts/new" search={{ routineDayId: day.id }} className="list-row">
                  <span className="list-row-title">{dayLabel(day)}</span>
                  <span className="list-row-meta">
                    {day.exerciseIds.length}{' '}
                    {day.exerciseIds.length === 1 ? 'exercise' : 'exercises'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link to="/workouts/new" className="button secondary">
        Empty workout
      </Link>
    </section>
  );
}
