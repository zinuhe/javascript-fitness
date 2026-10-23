import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { Equipment, MuscleGroup, type ExerciseProgressPoint } from '@fitness/contracts';
import { createExercise, exerciseQuery, exercisesQuery, progressQuery } from '../api/queries';
import { ErrorMessage, formatShortDate, labelize } from '../components/ui';
import { formatWeight, useWeightUnit } from '../components/units';

export function ExercisesPage() {
  const { data } = useSuspenseQuery(exercisesQuery);
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');

  const create = useMutation({
    mutationFn: createExercise,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exercisesQuery.queryKey }),
  });

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? data.items.filter((e) =>
        [e.name, labelize(e.muscleGroup), labelize(e.equipment)].some((text) =>
          text.toLowerCase().includes(needle),
        ),
      )
    : data.items;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const description = String(form.get('description')).trim();
    create.mutate(
      {
        name: String(form.get('name')).trim(),
        muscleGroup: form.get('muscleGroup') as MuscleGroup,
        equipment: form.get('equipment') as Equipment,
        description: description || undefined,
      },
      { onSuccess: () => formElement.reset() },
    );
  };

  return (
    <section className="stack">
      <h1>Exercises</h1>

      {data.items.length > 0 && (
        <input
          type="search"
          className="search"
          placeholder="Search exercises"
          aria-label="Search exercises"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {data.items.length === 0 ? (
        <p className="card muted empty">No exercises yet.</p>
      ) : visible.length === 0 ? (
        <p className="card muted empty">No exercises match “{query.trim()}”.</p>
      ) : (
        <ul className="card list-rows" aria-label="Exercise catalog">
          {visible.map((exercise) => (
            <li key={exercise.id}>
              <Link
                to="/exercises/$exerciseId"
                params={{ exerciseId: exercise.id }}
                className="list-row"
              >
                <span className="list-row-title">{exercise.name}</span>
                <span className="list-row-meta">
                  {labelize(exercise.muscleGroup)} · {labelize(exercise.equipment)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form className="card stack" onSubmit={onSubmit}>
        <h2>Add exercise</h2>
        <div className="grid-3">
          <label>
            Name
            <input name="name" maxLength={120} autoCapitalize="words" required />
          </label>
          <label>
            Muscle group
            <select name="muscleGroup" required defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {Object.values(MuscleGroup).map((value) => (
                <option key={value} value={value}>
                  {labelize(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Equipment
            <select name="equipment" required defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {Object.values(Equipment).map((value) => (
                <option key={value} value={value}>
                  {labelize(value)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Description
          <input name="description" maxLength={500} placeholder="Optional" />
        </label>
        <ErrorMessage error={create.error} />
        <div className="row">
          <button className="button" disabled={create.isPending}>
            {create.isPending ? 'Adding…' : 'Add exercise'}
          </button>
        </div>
      </form>
    </section>
  );
}

/**
 * Estimated 1RM over time as a small line chart. Pure SVG scaled to its container, so it
 * fits a phone as well as a desktop card; values are also listed in the table below it.
 */
function OneRepMaxChart({ points }: { points: ExerciseProgressPoint[] }) {
  const unit = useWeightUnit();
  const width = 320;
  const height = 120;
  const pad = 12;
  const values = points.map((p) => p.estimatedOneRepMaxKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (width - 2 * pad)) / (points.length - 1);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - 2 * pad);
  const path = points.map((p, i) => `${x(i)},${y(p.estimatedOneRepMaxKg)}`).join(' ');

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Estimated 1RM from ${formatWeight(values[0], unit)} to ${formatWeight(values[values.length - 1], unit)}`}
      >
        <polyline points={path} className="chart-line" />
        {points.map((p, i) => (
          <circle key={p.performedAt} cx={x(i)} cy={y(p.estimatedOneRepMaxKg)} r={3.5} />
        ))}
      </svg>
      <figcaption className="chart-axis">
        <span>{formatShortDate(points[0].performedAt)}</span>
        <span>Est. 1RM</span>
        <span>{formatShortDate(points[points.length - 1].performedAt)}</span>
      </figcaption>
    </figure>
  );
}

const detailRoute = getRouteApi('/_app/exercises/$exerciseId');

export function ExerciseDetailPage() {
  const { exerciseId } = detailRoute.useParams();
  const { data: exercise } = useSuspenseQuery(exerciseQuery(exerciseId));
  const { data: progress } = useSuspenseQuery(progressQuery(exerciseId));
  const unit = useWeightUnit();
  const points = [...progress.points].reverse(); // newest first
  const best = Math.max(0, ...progress.points.map((p) => p.estimatedOneRepMaxKg));
  const heaviest = Math.max(0, ...progress.points.map((p) => p.bestSetWeightKg));

  return (
    <section className="stack">
      <div>
        <Link to="/exercises" className="muted back-link">
          ← Exercises
        </Link>
        <h1>{exercise.name}</h1>
        <p className="row">
          <span className="tag">{labelize(exercise.muscleGroup)}</span>
          <span className="tag">{labelize(exercise.equipment)}</span>
        </p>
        {exercise.description && <p>{exercise.description}</p>}
      </div>

      <div className="card stack">
        <h2>Your progress</h2>
        {points.length === 0 ? (
          <p className="muted">
            No sets logged for this exercise yet. <Link to="/workouts/new">Log a workout</Link>
          </p>
        ) : (
          <>
            <dl className="stats">
              <div>
                <dt>Best est. 1RM</dt>
                <dd>{formatWeight(best, unit)}</dd>
              </div>
              <div>
                <dt>Heaviest set</dt>
                <dd>{formatWeight(heaviest, unit)}</dd>
              </div>
              <div>
                <dt>Sessions</dt>
                <dd>{points.length}</dd>
              </div>
            </dl>
            {progress.points.length > 1 && <OneRepMaxChart points={progress.points} />}
            <table className="compact">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Volume</th>
                  <th>Top set</th>
                  <th>Est. 1RM</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.performedAt}>
                    <td>{formatShortDate(point.performedAt)}</td>
                    <td>{formatWeight(point.totalVolumeKg, unit)}</td>
                    <td>{formatWeight(point.bestSetWeightKg, unit)}</td>
                    <td>{formatWeight(point.estimatedOneRepMaxKg, unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  );
}
