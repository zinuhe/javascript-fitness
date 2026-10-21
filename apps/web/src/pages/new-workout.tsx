import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { CreateWorkoutRequest } from '@fitness/contracts';
import { createWorkout, exercisesQuery } from '../api/queries';
import { ErrorMessage } from '../components/ui';

// Inputs hold strings while editing; they are converted once on submit.
interface SetDraft {
  reps: string;
  weightKg: string;
}

interface ExerciseDraft {
  key: number;
  exerciseId: string;
  sets: SetDraft[];
}

let nextKey = 0;
const emptySet = (): SetDraft => ({ reps: '', weightKg: '' });
const emptyExercise = (): ExerciseDraft => ({
  key: nextKey++,
  exerciseId: '',
  sets: [emptySet()],
});

/** Current local time in the `YYYY-MM-DDTHH:mm` shape `datetime-local` expects. */
function nowForInput(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function NewWorkoutPage() {
  const { data: catalog } = useSuspenseQuery(exercisesQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [performedAt, setPerformedAt] = useState(nowForInput);
  const [notes, setNotes] = useState('');
  const [entries, setEntries] = useState<ExerciseDraft[]>(() => [emptyExercise()]);

  const save = useMutation({
    mutationFn: createWorkout,
    onSuccess: async (workout) => {
      await queryClient.invalidateQueries({ queryKey: ['workouts'] });
      await queryClient.invalidateQueries({ queryKey: ['progress'] });
      await navigate({ to: '/workouts/$workoutId', params: { workoutId: workout.id } });
    },
  });

  const updateEntry = (key: number, change: (entry: ExerciseDraft) => ExerciseDraft) =>
    setEntries((all) => all.map((e) => (e.key === key ? change(e) : e)));

  const updateSet = (key: number, index: number, patch: Partial<SetDraft>) =>
    updateEntry(key, (e) => ({
      ...e,
      sets: e.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const request: CreateWorkoutRequest = {
      performedAt: new Date(performedAt).toISOString(),
      notes: notes.trim() || undefined,
      exercises: entries.map((e) => ({
        exerciseId: e.exerciseId,
        sets: e.sets.map((s) => ({ reps: Number(s.reps), weightKg: Number(s.weightKg) })),
      })),
    };
    save.mutate(request);
  };

  if (catalog.items.length === 0) {
    return (
      <section className="card empty">
        <p>The exercise catalog is empty.</p>
        <Link to="/exercises">Add an exercise first</Link>
      </section>
    );
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="page-header">
        <div>
          <Link to="/workouts" className="muted">
            ← Workouts
          </Link>
          <h1>Log workout</h1>
        </div>
      </div>

      <div className="card grid-2">
        <label>
          Date
          <input
            type="datetime-local"
            value={performedAt}
            onChange={(e) => setPerformedAt(e.target.value)}
            required
          />
        </label>
        <label>
          Notes
          <input
            value={notes}
            maxLength={1000}
            placeholder="Optional"
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>

      {entries.map((entry, entryIndex) => (
        <fieldset key={entry.key} className="card stack">
          <div className="row between">
            <legend>Exercise {entryIndex + 1}</legend>
            {entries.length > 1 && (
              <button
                type="button"
                className="button secondary small"
                onClick={() => setEntries((all) => all.filter((e) => e.key !== entry.key))}
              >
                Remove
              </button>
            )}
          </div>
          <select
            aria-label={`Exercise ${entryIndex + 1}`}
            value={entry.exerciseId}
            onChange={(e) => updateEntry(entry.key, (d) => ({ ...d, exerciseId: e.target.value }))}
            required
          >
            <option value="">Choose an exercise…</option>
            {catalog.items.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>

          {entry.sets.map((set, setIndex) => (
            <div key={setIndex} className="set-row">
              <span className="muted">Set {setIndex + 1}</span>
              <label>
                Reps
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  step={1}
                  value={set.reps}
                  onChange={(e) => updateSet(entry.key, setIndex, { reps: e.target.value })}
                  required
                />
              </label>
              <label>
                Weight (kg)
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={9999.99}
                  step={0.25}
                  value={set.weightKg}
                  onChange={(e) => updateSet(entry.key, setIndex, { weightKg: e.target.value })}
                  required
                />
              </label>
              <button
                type="button"
                className="button secondary small"
                aria-label={`Remove set ${setIndex + 1}`}
                disabled={entry.sets.length === 1}
                onClick={() =>
                  updateEntry(entry.key, (d) => ({
                    ...d,
                    sets: d.sets.filter((_, i) => i !== setIndex),
                  }))
                }
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button secondary small"
            onClick={() =>
              updateEntry(entry.key, (d) => {
                // Pre-fill from the previous set: most sets repeat reps and weight.
                const last = d.sets[d.sets.length - 1];
                return { ...d, sets: [...d.sets, last ? { ...last } : emptySet()] };
              })
            }
          >
            + Add set
          </button>
        </fieldset>
      ))}

      <button
        type="button"
        className="button secondary"
        onClick={() => setEntries((all) => [...all, emptyExercise()])}
      >
        + Add exercise
      </button>

      <ErrorMessage error={save.error} />
      <div className="row">
        <button className="button" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save workout'}
        </button>
        <Link to="/workouts" className="button secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
