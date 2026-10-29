import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import type { Exercise, WorkoutExercise, WorkoutSet } from '@fitness/contracts';
import {
  deleteWorkout,
  exercisesQuery,
  nextRoutineQuery,
  workoutQuery,
  workoutsQuery,
} from '../api/queries';
import { ErrorMessage, dayLabel, exerciseNames, formatDay, labelize } from '../components/ui';
import { BarWord } from '../components/bar';
import {
  formatVolume,
  formatWeight,
  formatWholeInOtherUnit,
  useWeightUnit,
} from '../components/units';
import { NextUpCard } from './start';

/** Every set the same (reps, weight, RPE and rest): shown as one row, "4 × …". */
function allAlike(sets: WorkoutSet[]): boolean {
  const [first] = sets;
  return (
    sets.length > 1 &&
    sets.every(
      (s) =>
        s.reps === first.reps &&
        s.weightKg === first.weightKg &&
        s.rpe === first.rpe &&
        s.restSeconds === first.restSeconds,
    )
  );
}

/** "Dumbbell ×2": the equipment, with how many dumbbells when it is dumbbells. */
function equipmentTag(entry: WorkoutExercise): string {
  const name = labelize(entry.equipment ?? '');
  return entry.dumbbells ? `${name} ×${entry.dumbbells}` : name;
}

/** "Bench Press (Dumbbell ×2)": the exercise with the equipment it was done with. */
function loggedExerciseLabel(entry: WorkoutExercise, catalog: Exercise[]): string {
  const exercise = catalog.find((e) => e.id === entry.exerciseId);
  if (!exercise) return 'Unknown exercise';
  return entry.equipment ? `${exercise.name} (${equipmentTag(entry)})` : exercise.name;
}

const listRoute = getRouteApi('/_app/workouts');

export function WorkoutsPage() {
  const { page = 1 } = listRoute.useSearch();
  const { data } = useSuspenseQuery(workoutsQuery(page));
  const { data: catalog } = useSuspenseQuery(exercisesQuery);
  const { data: next } = useSuspenseQuery(nextRoutineQuery);
  const unit = useWeightUnit();

  return (
    <section className="stack">
      <div className="page-header">
        <h1>Workouts</h1>
        {/* On phones the tab bar's + does this. */}
        <Link to="/workouts/new" className="button hide-on-phone">
          Log workout
        </Link>
      </div>

      {next && page === 1 && <NextUpCard next={next} />}

      {data.items.length === 0 ? (
        <div className="card empty">
          <p>No workouts logged yet.</p>
          <Link to="/workouts/new">Log your first session</Link>
        </div>
      ) : (
        <ul className="list">
          {data.items.map((workout) => {
            const totalSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
            const allSets = workout.exercises.flatMap((e) => e.sets);
            return (
              <li key={workout.id}>
                <Link
                  to="/workouts/$workoutId"
                  params={{ workoutId: workout.id }}
                  className="card link-card"
                >
                  <strong>{formatDay(workout.performedAt)}</strong>
                  <p className="card-meta">
                    {workout.routineDay && (
                      <span className="day-chip">{dayLabel(workout.routineDay)}</span>
                    )}
                    {totalSets} sets · Volume {formatVolume(allSets, unit)}
                  </p>
                  <p className="muted">
                    {workout.exercises
                      .map((e) => loggedExerciseLabel(e, catalog.items))
                      .join(' · ')}
                  </p>
                  {workout.notes && <p className="notes">{workout.notes}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {data.totalPages > 1 && (
        <nav className="row between" aria-label="Pagination">
          <Link
            to="/workouts"
            search={{ page: page - 1 }}
            disabled={page <= 1}
            className="button secondary"
          >
            ← Newer
          </Link>
          <span className="muted">
            Page {data.page} of {data.totalPages}
          </span>
          <Link
            to="/workouts"
            search={{ page: page + 1 }}
            disabled={page >= data.totalPages}
            className="button secondary"
          >
            Older →
          </Link>
        </nav>
      )}
    </section>
  );
}

const detailRoute = getRouteApi('/_app/workouts/$workoutId');

export function WorkoutDetailPage() {
  const { workoutId } = detailRoute.useParams();
  const { data: workout } = useSuspenseQuery(workoutQuery(workoutId));
  const { data: catalog } = useSuspenseQuery(exercisesQuery);
  const names = exerciseNames(catalog.items);
  const unit = useWeightUnit();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const remove = useMutation({
    mutationFn: () => deleteWorkout(workoutId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: workoutQuery(workoutId).queryKey });
      await queryClient.invalidateQueries({ queryKey: ['workouts'] });
      await queryClient.invalidateQueries({ queryKey: ['progress'] });
      await navigate({ to: '/workouts' });
    },
  });

  const totalSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
  const allSets = workout.exercises.flatMap((e) => e.sets);

  return (
    <section className="stack">
      <div className="detail-header">
        <div>
          <Link to="/workouts" className="muted back-link">
            ← Workouts
          </Link>
          <h1>{formatDay(workout.performedAt)}</h1>
          <p className="muted">
            {totalSets} sets · Volume {formatVolume(allSets, unit)}
          </p>
          {workout.routineDay && (
            <p>
              <Link
                to="/routines/$routineId"
                params={{ routineId: workout.routineDay.routineId }}
                className="day-chip"
              >
                {dayLabel(workout.routineDay)} · {workout.routineDay.routineName}
              </Link>
            </p>
          )}
        </div>
        <div className="detail-actions">
          <Link to="/workouts/$workoutId/edit" params={{ workoutId }} className="button secondary">
            Edit
          </Link>
          <button
            type="button"
            className="button danger"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm('Delete this workout? This cannot be undone.')) remove.mutate();
            }}
          >
            Delete
          </button>
        </div>
      </div>
      <ErrorMessage error={remove.error} />
      {workout.notes && <p className="notes">{workout.notes}</p>}

      {workout.exercises.map((entry) => {
        // Optional columns only when this exercise has data for them.
        const showRpe = entry.sets.some((set) => set.rpe !== undefined);
        const showRest = entry.sets.some((set) => set.restSeconds !== undefined);
        return (
          <article key={entry.id} className="card">
            <div className="row between">
              <div className="row">
                <h2>
                  <Link to="/exercises/$exerciseId" params={{ exerciseId: entry.exerciseId }}>
                    {names.get(entry.exerciseId) ?? 'Unknown exercise'}
                  </Link>
                </h2>
                {/* What it was done with, for every exercise. */}
                {entry.equipment && (
                  <span className="tag" aria-label={`Equipment: ${equipmentTag(entry)}`}>
                    {equipmentTag(entry)}
                  </span>
                )}
              </div>
              {/* Volume: reps × weight of every set, added up. */}
              <span className="muted">Volume {formatVolume(entry.sets, unit)}</span>
            </div>
            <table>
              <thead>
                <tr>
                  {/* All sets alike: one row, the first column counts them. */}
                  <th>{allAlike(entry.sets) ? 'Sets' : 'Set'}</th>
                  <th>Reps</th>
                  <th>Weight</th>
                  {showRpe && <th>RPE</th>}
                  {showRest && <th>Rest</th>}
                </tr>
              </thead>
              <tbody>
                {(allAlike(entry.sets) ? entry.sets.slice(0, 1) : entry.sets).map((set, index) => (
                  <tr key={set.id}>
                    <td>{allAlike(entry.sets) ? entry.sets.length : index + 1}</td>
                    <td>{set.reps}</td>
                    {/* Barbell sets store the total: show the plates as typed, the sum below. */}
                    {entry.barKg !== undefined ? (
                      <td>
                        {formatWeight(set.weightKg - entry.barKg, unit)}{' '}
                        <span className="hint">
                          ({formatWholeInOtherUnit(set.weightKg - entry.barKg, unit)})
                        </span>
                        <span className="hint cell-note">
                          {formatWeight(set.weightKg - entry.barKg, unit)} +{' '}
                          <BarWord barKg={entry.barKg} /> = {formatWeight(set.weightKg, unit)} (
                          {formatWholeInOtherUnit(set.weightKg, unit)})
                        </span>
                      </td>
                    ) : (
                      <td>
                        {formatWeight(set.weightKg, unit)}{' '}
                        {/* The other unit, small: "40 lb (18 kg)". */}
                        <span className="hint">({formatWholeInOtherUnit(set.weightKg, unit)})</span>
                      </td>
                    )}
                    {showRpe && <td>{set.rpe ?? '—'}</td>}
                    {showRest && (
                      <td>{set.restSeconds !== undefined ? `${set.restSeconds}s` : '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
              {entry.sets.length > 1 && (
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td>{entry.sets.reduce((n, set) => n + set.reps, 0)}</td>
                    <td colSpan={1 + Number(showRpe) + Number(showRest)}>
                      {formatVolume(entry.sets, unit)} volume
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </article>
        );
      })}
    </section>
  );
}
