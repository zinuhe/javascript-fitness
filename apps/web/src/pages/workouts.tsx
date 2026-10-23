import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import {
  deleteWorkout,
  exercisesQuery,
  nextRoutineQuery,
  workoutQuery,
  workoutsQuery,
} from '../api/queries';
import {
  ErrorMessage,
  dayLabel,
  exerciseNames,
  formatDay,
  formatKg,
  formatTime,
  setsVolume,
} from '../components/ui';
import { NextUpCard } from './start';

const listRoute = getRouteApi('/_app/workouts');

export function WorkoutsPage() {
  const { page = 1 } = listRoute.useSearch();
  const { data } = useSuspenseQuery(workoutsQuery(page));
  const { data: catalog } = useSuspenseQuery(exercisesQuery);
  const { data: next } = useSuspenseQuery(nextRoutineQuery);
  const names = exerciseNames(catalog.items);

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
            const volume = workout.exercises.reduce((v, e) => v + setsVolume(e.sets), 0);
            return (
              <li key={workout.id}>
                <Link
                  to="/workouts/$workoutId"
                  params={{ workoutId: workout.id }}
                  className="card link-card"
                >
                  <div className="row between">
                    <strong>{formatDay(workout.performedAt)}</strong>
                    <span className="muted">{formatTime(workout.performedAt)}</span>
                  </div>
                  <p className="card-meta">
                    {workout.routineDay && (
                      <span className="day-chip">{dayLabel(workout.routineDay)}</span>
                    )}
                    {totalSets} sets · {formatKg(volume)}
                  </p>
                  <p className="muted">
                    {workout.exercises
                      .map((e) => names.get(e.exerciseId) ?? 'Unknown exercise')
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
  const volume = workout.exercises.reduce((v, e) => v + setsVolume(e.sets), 0);

  return (
    <section className="stack">
      <div className="detail-header">
        <div>
          <Link to="/workouts" className="muted back-link">
            ← Workouts
          </Link>
          <h1>{formatDay(workout.performedAt)}</h1>
          <p className="muted">
            {formatTime(workout.performedAt)} · {totalSets} sets · {formatKg(volume)}
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
              <h2>
                <Link to="/exercises/$exerciseId" params={{ exerciseId: entry.exerciseId }}>
                  {names.get(entry.exerciseId) ?? 'Unknown exercise'}
                </Link>
              </h2>
              <span className="muted">{formatKg(setsVolume(entry.sets))}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Set</th>
                  <th>Reps</th>
                  <th>Weight</th>
                  {showRpe && <th>RPE</th>}
                  {showRest && <th>Rest</th>}
                </tr>
              </thead>
              <tbody>
                {entry.sets.map((set, index) => (
                  <tr key={set.id}>
                    <td>{index + 1}</td>
                    <td>{set.reps}</td>
                    <td>{formatKg(set.weightKg)}</td>
                    {showRpe && <td>{set.rpe ?? '—'}</td>}
                    {showRest && (
                      <td>{set.restSeconds !== undefined ? `${set.restSeconds}s` : '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        );
      })}
    </section>
  );
}
