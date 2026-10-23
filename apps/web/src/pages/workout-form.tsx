import { useId, useState, type FormEvent, type ReactNode } from 'react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
  type UseMutationResult,
} from '@tanstack/react-query';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import type {
  CreateWorkoutRequest,
  LastExerciseSets,
  RoutineDay,
  Workout,
} from '@fitness/contracts';
import {
  createWorkout,
  exercisesQuery,
  lastSetsQuery,
  routinesQuery,
  updateWorkout,
  workoutQuery,
} from '../api/queries';
import { ErrorMessage, dayLabel, parseDecimal } from '../components/ui';

const REPS_STEP = 1;
const WEIGHT_STEP = 2.5;

/** Next value for a −/+ tap: starts from 0 when empty, never goes below `min`. */
function stepValue(current: string, delta: number, min: number): string {
  const base = current.trim() === '' ? 0 : parseDecimal(current);
  const next = Math.max(min, (Number.isFinite(base) ? base : 0) + delta);
  return String(Math.round(next * 100) / 100);
}

interface StepperProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step: number;
  min: number;
  /** Mobile keypad: whole numbers for reps, decimals (with "," or ".") for weight. */
  decimal?: boolean;
}

/**
 * Number field with large −/+ buttons, built for thumbs at the gym. A text input (not
 * type=number) so iOS shows the right keypad and a decimal comma is accepted.
 */
function Stepper({ label, value, onChange, step, min, decimal = false }: StepperProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="stepper">
        <button
          type="button"
          className="step"
          aria-label={`${label}: decrease`}
          onClick={() => onChange(stepValue(value, -step, min))}
        >
          −
        </button>
        <input
          id={id}
          type="text"
          inputMode={decimal ? 'decimal' : 'numeric'}
          pattern={decimal ? '[0-9]+([.,][0-9]{1,2})?' : '[0-9]+'}
          autoComplete="off"
          enterKeyHint="next"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
        <button
          type="button"
          className="step"
          aria-label={`${label}: increase`}
          onClick={() => onChange(stepValue(value, step, min))}
        >
          +
        </button>
      </div>
    </div>
  );
}

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

/**
 * A routine day as a ready-to-log draft: its exercises in order, each starting from the sets
 * of the last time the user did it (or one empty set the first time).
 */
function draftFromRoutineDay(day: RoutineDay, lastSets: LastExerciseSets[]): WorkoutDraft {
  const byExercise = new Map(lastSets.map((entry) => [entry.exerciseId, entry.sets]));
  return {
    performedAt: toInputDate(new Date()),
    notes: '',
    entries: day.exerciseIds.map((exerciseId) => {
      const previous = byExercise.get(exerciseId);
      return {
        key: nextKey++,
        exerciseId,
        sets: previous?.length
          ? previous.map((set) => ({
              reps: String(set.reps),
              weightKg: String(set.weightKg),
              rpe: set.rpe,
              restSeconds: set.restSeconds,
            }))
          : [emptySet()],
      };
    }),
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
      // The routine rotation and the "last time" pre-fill both moved on.
      await queryClient.invalidateQueries({ queryKey: ['routines'] });
      await queryClient.invalidateQueries({ queryKey: ['last-sets'] });
      await navigate({ to: '/workouts/$workoutId', params: { workoutId: workout.id } });
    },
  });
}

const newRoute = getRouteApi('/_app/workouts/new');

/** The routine day `routineDayId` points to, with its routine; null when it is gone. */
function useRoutineDay(routineDayId: string | undefined) {
  const { data: routines } = useSuspenseQuery(routinesQuery);
  for (const routine of routines) {
    const day = routine.days.find((d) => d.id === routineDayId);
    if (day) return { routine, day };
  }
  return null;
}

export function NewWorkoutPage() {
  const { routineDayId } = newRoute.useSearch();
  const found = useRoutineDay(routineDayId);
  const { data: lastSets } = useSuspenseQuery(lastSetsQuery(found?.day.exerciseIds ?? []));
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

  if (found) {
    return (
      <WorkoutForm
        // A different day (same route) must start from its own draft.
        key={found.day.id}
        title={dayLabel(found.day)}
        subtitle={found.routine.name}
        submitLabel="Save workout"
        initial={() => draftFromRoutineDay(found.day, lastSets)}
        routineDayId={found.day.id}
        save={save}
        back={back}
        cancel={cancel}
      />
    );
  }

  return (
    <WorkoutForm
      key="empty"
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
  /** Shown under the title, e.g. the routine name. */
  subtitle?: string;
  submitLabel: string;
  /** Routine day the session follows; sent with the workout so the rotation advances. */
  routineDayId?: string;
  /** Lazy initial state: read once, when the form mounts. */
  initial: () => WorkoutDraft;
  save: UseMutationResult<Workout, Error, CreateWorkoutRequest>;
  back: ReactNode;
  cancel: ReactNode;
}

function WorkoutForm({
  title,
  subtitle,
  submitLabel,
  routineDayId,
  initial,
  save,
  back,
  cancel,
}: WorkoutFormProps) {
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
      ...(routineDayId ? { routineDayId } : {}),
      exercises: entries.map((e) => ({
        exerciseId: e.exerciseId,
        sets: e.sets.map((s) => ({
          reps: parseDecimal(s.reps),
          weightKg: parseDecimal(s.weightKg),
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
          {subtitle && <p className="muted">{subtitle}</p>}
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
            <div key={setIndex} className="set">
              <div className="set-head">
                <span className="muted">Set {setIndex + 1}</span>
                <button
                  type="button"
                  className="icon-button"
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
              <div className="set-fields">
                <Stepper
                  label="Reps"
                  value={set.reps}
                  step={REPS_STEP}
                  min={1}
                  onChange={(reps) => updateSet(entry.key, setIndex, { reps })}
                />
                <Stepper
                  label="Weight (kg)"
                  value={set.weightKg}
                  step={WEIGHT_STEP}
                  min={0}
                  decimal
                  onChange={(weightKg) => updateSet(entry.key, setIndex, { weightKg })}
                />
              </div>
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
      {/* Sticky on phones: Save stays under the thumb however long the session gets. */}
      <div className="form-actions">
        <button className="button" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : submitLabel}
        </button>
        {cancel}
      </div>
    </form>
  );
}
