import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { NextRoutineDay } from '@fitness/contracts';
import { exercisesQuery, nextRoutineQuery, workoutsTodayQuery } from '../api/queries';
import { dayLabel, exerciseNames } from '../components/ui';

/**
 * "Next up" call to action for the active routine (Workouts list and Start page). Once a
 * workout is logged today it only announces the next day: there is one workout per date, so
 * it can't be started until tomorrow.
 */
export function NextUpCard({ next }: { next: NextRoutineDay }) {
  const { data: catalog } = useSuspenseQuery(exercisesQuery);
  const { data: today } = useSuspenseQuery(workoutsTodayQuery());
  const names = exerciseNames(catalog.items);
  const body = (
    <>
      <span className="next-up-kicker">Next up · {next.routine.name}</span>
      <strong className="next-up-title">{dayLabel(next.day)}</strong>
      <span className="muted">
        {next.day.exerciseIds.map((id) => names.get(id) ?? 'Unknown exercise').join(' · ')}
      </span>
    </>
  );
  if (today.items.length > 0) {
    return (
      <div
        className="card next-up next-up-done"
        role="group"
        aria-label={`Next up: ${dayLabel(next.day)} of ${next.routine.name}`}
      >
        {body}
        <button
          type="button"
          className="button next-up-cta"
          disabled
          aria-describedby="next-up-done-note"
        >
          Start
        </button>
        <span id="next-up-done-note" className="hint">
          You already logged a workout today.
        </span>
      </div>
    );
  }
  return (
    <Link
      to="/workouts/new"
      search={{ routineDayId: next.day.id }}
      className="card link-card next-up"
      aria-label={`Start ${dayLabel(next.day)} of ${next.routine.name}`}
    >
      {body}
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
      {next.day.warmupExerciseIds.length > 0 && (
        // Before starting: the workout form keeps no draft if you leave it.
        <Link to="/exercises/warmup" search={{ day: next.day.id }} className="button secondary">
          Warm-up for {dayLabel(next.day)} · {next.day.warmupExerciseIds.length}{' '}
          {next.day.warmupExerciseIds.length === 1 ? 'exercise' : 'exercises'}
        </Link>
      )}

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
