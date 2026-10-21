import type { FormEvent } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { Equipment, MuscleGroup } from '@fitness/contracts';
import { createExercise, exerciseQuery, exercisesQuery, progressQuery } from '../api/queries';
import { ErrorMessage, formatDate, formatKg, labelize } from '../components/ui';

export function ExercisesPage() {
  const { data } = useSuspenseQuery(exercisesQuery);
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: createExercise,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exercisesQuery.queryKey }),
  });

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

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Muscle group</th>
              <th>Equipment</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((exercise) => (
              <tr key={exercise.id}>
                <td>
                  <Link to="/exercises/$exerciseId" params={{ exerciseId: exercise.id }}>
                    {exercise.name}
                  </Link>
                </td>
                <td>{labelize(exercise.muscleGroup)}</td>
                <td>{labelize(exercise.equipment)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.items.length === 0 && <p className="muted empty">No exercises yet.</p>}
      </div>

      <form className="card stack" onSubmit={onSubmit}>
        <h2>Add exercise</h2>
        <div className="grid-3">
          <label>
            Name
            <input name="name" maxLength={120} required />
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

const detailRoute = getRouteApi('/_app/exercises/$exerciseId');

export function ExerciseDetailPage() {
  const { exerciseId } = detailRoute.useParams();
  const { data: exercise } = useSuspenseQuery(exerciseQuery(exerciseId));
  const { data: progress } = useSuspenseQuery(progressQuery(exerciseId));
  const points = [...progress.points].reverse(); // newest first
  const best = Math.max(0, ...progress.points.map((p) => p.estimatedOneRepMaxKg));

  return (
    <section className="stack">
      <div>
        <Link to="/exercises" className="muted">
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
        <div className="row between">
          <h2>Your progress</h2>
          {best > 0 && <span className="muted">Best est. 1RM: {formatKg(best)}</span>}
        </div>
        {points.length === 0 ? (
          <p className="muted">
            No sets logged for this exercise yet. <Link to="/workouts/new">Log a workout</Link>
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Session</th>
                <th>Volume</th>
                <th>Heaviest set</th>
                <th>Est. 1RM</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.performedAt}>
                  <td>{formatDate(point.performedAt)}</td>
                  <td>{formatKg(point.totalVolumeKg)}</td>
                  <td>{formatKg(point.bestSetWeightKg)}</td>
                  <td>
                    <span
                      className="bar"
                      style={{ width: `${(point.estimatedOneRepMaxKg / best) * 100}%` }}
                    />
                    {formatKg(point.estimatedOneRepMaxKg)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
