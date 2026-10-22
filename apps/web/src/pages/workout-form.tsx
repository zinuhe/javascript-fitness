import { useState, type FormEvent, type ReactNode } from 'react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
  type UseMutationResult,
} from '@tanstack/react-query';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import type { CreateWorkoutRequest, Workout } from '@fitness/contracts';
import { createWorkout, exercisesQuery, updateWorkout, workoutQuery } from '../api/queries';
import { ErrorMessage } from '../components/ui';

// Inputs hold strings while editing; they are converted once on submit. RPE and rest are
// not editable in this form, but are carried through so editing a workout keeps them.
interface SetDraft {
  reps: string;
  weightKg: string;
  rpe?: number;
  restSeconds?: number;
}

interface ExerciseDraft {
  key: number;
  exerciseId: string;
  sets: SetDraft[];
}

interface WorkoutDraft {
  performedAt: string;
  notes: string;
  entries: ExerciseDraft[];
}

let nextKey = 0;
const emptySet = (): SetDraft => ({ reps: '', weightKg: '' });
const emptyExercise = (): ExerciseDraft => ({
  key: nextKey++,
  exerciseId: '',
  sets: [emptySet()],
});

/** Local time of `date` in the `YYYY-MM-DDTHH:mm` shape `datetime-local` expects. */
function toInputDate(date: Date): string {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

function draftFromWorkout(workout: Workout): WorkoutDraft {
  return {
    performedAt: toInputDate(new Date(workout.performedAt)),
    notes: workout.notes ?? '',
    entries: workout.exercises.map((entry) => ({
      key: nextKey++,
      exerciseId: entry.exerciseId,
      sets: entry.sets.map((set) => ({
        reps: String(set.reps),
        weightKg: String(set.weightKg),
        rpe: set.rpe,
        restSeconds: set.restSeconds,
      })),
    })),
  };
}

function useSaveWorkout(mutationFn: (input: CreateWorkoutRequest) => Promise<Workout>) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn,
    onSuccess: async (workout) => {
      queryClient.setQueryData(workoutQuery(workout.id).queryKey, workout);
      await queryClient.invalidateQueries({ queryKey: ['workouts'] });
      await queryClient.invalidateQueries({ queryKey: ['progress'] });
      await navigate({ to: '/workouts/$workoutId', params: { workoutId: workout.id } });
    },
  });
}

export function NewWorkoutPage() {
  const save = useSaveWorkout(createWorkout);
  const back = (
    <Link to="/workouts" className="muted">
      ← Workouts
    </Link>
  );
  const cancel = (
    <Link to="/workouts" className="button secondary">
      Cancel
    </Link>
  );

  return (
    <WorkoutForm
      title="Log workout"
      submitLabel="Save workout"
      initial={() => ({
        performedAt: toInputDate(new Date()),
        notes: '',
        entries: [emptyExercise()],
      })}
      save={save}
      back={back}
      cancel={cancel}
    />
  );
}

const editRoute = getRouteApi('/_app/workouts/$workoutId/edit');

export function EditWorkoutPage() {
  const { workoutId } = editRoute.useParams();
  const { data: workout } = useSuspenseQuery(workoutQuery(workoutId));
  const save = useSaveWorkout((input) => updateWorkout(workoutId, input));
  const back = (
    <Link to="/workouts/$workoutId" params={{ workoutId }} className="muted">
      ← Workout
    </Link>
  );
  const cancel = (
    <Link to="/workouts/$workoutId" params={{ workoutId }} className="button secondary">
      Cancel
    </Link>
  );

  return (
    <WorkoutForm
      title="Edit workout"
      submitLabel="Save changes"
      initial={() => draftFromWorkout(workout)}
      save={save}
      back={back}
      cancel={cancel}
    />
  );
}

interface WorkoutFormProps {
  title: string;
  submitLabel: string;
  /** Lazy initial state: read once, when the form mounts. */
  initial: () => WorkoutDraft;
  save: UseMutationResult<Workout, Error, CreateWorkoutRequest>;
  back: ReactNode;
  cancel: ReactNode;
}

function WorkoutForm({ title, submitLabel, initial, save, back, cancel }: WorkoutFormProps) {
  const { data: catalog } = useSuspenseQuery(exercisesQuery);
  const [draft] = useState(initial);
  const [performedAt, setPerformedAt] = useState(draft.performedAt);
  const [notes, setNotes] = useState(draft.notes);
  const [entries, setEntries] = useState<ExerciseDraft[]>(draft.entries);

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
        sets: e.sets.map((s) => ({
          reps: Number(s.reps),
          weightKg: Number(s.weightKg),
          ...(s.rpe !== undefined ? { rpe: s.rpe } : {}),
          ...(s.restSeconds !== undefined ? { restSeconds: s.restSeconds } : {}),
        })),
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
          {back}
          <h1>{title}</h1>
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
        // Named via aria-labelledby: a <legend> only names its fieldset as the first child,
        // and here the title shares a row with the remove button.
        <fieldset
          key={entry.key}
          className="card stack"
          aria-labelledby={`exercise-${entry.key}-title`}
        >
          <div className="row between">
            <span id={`exercise-${entry.key}-title`} className="legend">
              Exercise {entryIndex + 1}
            </span>
            {entries.length > 1 && (
              <button
                type="button"
                className="button secondary small"
                aria-label={`Remove exercise ${entryIndex + 1}`}
                onClick={() => setEntries((all) => all.filter((e) => e.key !== entry.key))}
              >
                Remove
              </button>
            )}
          </div>
          <select
            aria-label="Exercise"
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
          {save.isPending ? 'Saving…' : submitLabel}
        </button>
        {cancel}
      </div>
    </form>
  );
}
