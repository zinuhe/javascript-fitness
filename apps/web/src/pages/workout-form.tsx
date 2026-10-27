import { useId, useState, type FormEvent, type ReactNode } from 'react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
  type UseMutationResult,
} from '@tanstack/react-query';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import type {
  Equipment,
  Exercise,
  LastExerciseSets,
  RoutineDay,
  UpdateWorkoutRequest,
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
import { ErrorMessage, dayLabel, labelize, parseDecimal } from '../components/ui';
import { WEIGHT_STEP, toKg, useWeightUnit, weightInputValue } from '../components/units';
import type { WeightUnit } from '@fitness/contracts';

const REPS_STEP = 1;

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
  required?: boolean;
  /** Marks the field when the form found a problem with it (the alert says which). */
  invalid?: boolean;
}

/**
 * Number field with large −/+ buttons, built for thumbs at the gym. A text input (not
 * type=number) so iOS shows the right keypad and a decimal comma is accepted.
 */
function Stepper({
  label,
  value,
  onChange,
  step,
  min,
  decimal = false,
  required = false,
  invalid = false,
}: StepperProps) {
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
          required={required}
          aria-invalid={invalid || undefined}
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
  /** In the user's unit (kg or lb), as typed. */
  weight: string;
  rpe?: number;
  restSeconds?: number;
}

interface ExerciseDraft {
  key: number;
  exerciseId: string;
  /** Which of the exercise's equipment is used; '' until an exercise is chosen. */
  equipment: Equipment | '';
  sets: SetDraft[];
  /**
   * The sets are still as pre-filled (not typed over), so switching the equipment may swap
   * them for the last ones done with it.
   */
  pristine: boolean;
}

interface WorkoutDraft {
  /** Day only, `YYYY-MM-DD`: the time of day is not asked for. */
  performedAt: string;
  /** The saved date and time, kept as is when an edit leaves the day unchanged. */
  savedPerformedAt?: string;
  notes: string;
  entries: ExerciseDraft[];
}

const API_FIELDS: Record<string, string> = {
  reps: 'reps',
  weightKg: 'weight',
  rpe: 'RPE',
  restSeconds: 'rest',
  equipment: 'equipment',
  exerciseId: 'exercise',
};

/**
 * Rewrites an API validation detail such as "exercises.4.sets.0.reps must not be less
 * than 1" as "Exercise 5 · Split Squat, set 1: reps must not be less than 1".
 */
function describeApiDetail(detail: string, sentLabels: string[]): string {
  const match = /^exercises\.(\d+)(?:\.sets\.(\d+))?\.(\w+) (.*)$/.exec(detail);
  if (!match) return detail;
  const [, exercise, set, field, rest] = match;
  const label = sentLabels[Number(exercise)] ?? `Exercise ${Number(exercise) + 1}`;
  const where = set === undefined ? label : `${label}, set ${Number(set) + 1}`;
  return `${where}: ${API_FIELDS[field] ?? field} ${rest}`;
}

/** A problem with a typed set, found before sending: names the exercise, set and field. */
interface SetProblem {
  key: number;
  setIndex: number;
  field: 'reps' | 'weight';
  message: string;
}

const MAX_REPS = 1000;
const MAX_WEIGHT_KG = 9999.99;

// A set with neither reps nor weight was not done; an exercise with only such sets was
// skipped (a tired day), and neither is saved.
const isBlankSet = (set: SetDraft) => set.reps.trim() === '' && set.weight.trim() === '';
const isSkipped = (entry: ExerciseDraft) => entry.sets.every(isBlankSet);

let nextKey = 0;
const emptySet = (): SetDraft => ({ reps: '', weight: '' });
const emptyExercise = (): ExerciseDraft => ({
  key: nextKey++,
  exerciseId: '',
  equipment: '',
  sets: [emptySet()],
  pristine: true,
});

const toSetDrafts = (sets: LastExerciseSets['sets'], unit: WeightUnit): SetDraft[] =>
  sets.map((set) => ({
    reps: String(set.reps),
    weight: weightInputValue(set.weightKg, unit),
    rpe: set.rpe,
    restSeconds: set.restSeconds,
  }));

/** The last sets done with this exercise and equipment, or one empty set the first time. */
function lastSetsFor(
  lastSets: LastExerciseSets[],
  exerciseId: string,
  equipment: Equipment | '',
  unit: WeightUnit,
): SetDraft[] {
  const previous = lastSets.find((e) => e.exerciseId === exerciseId && e.equipment === equipment);
  return previous?.sets.length ? toSetDrafts(previous.sets, unit) : [emptySet()];
}

/** Local day of `date` in the `YYYY-MM-DD` shape a date input expects. */
function toInputDate(date: Date): string {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
}

/**
 * The instant to store for a chosen day. Only the day matters, but the routine rotation
 * orders workouts by it: today is now (after anything logged earlier today), an unchanged
 * day keeps its saved time, and any other day is noon there (safe from time-zone shifts).
 */
function performedAtFor(day: string, saved?: string): string {
  if (saved && toInputDate(new Date(saved)) === day) return saved;
  if (day === toInputDate(new Date())) return new Date().toISOString();
  return new Date(`${day}T12:00`).toISOString();
}

function draftFromWorkout(workout: Workout, unit: WeightUnit): WorkoutDraft {
  return {
    performedAt: toInputDate(new Date(workout.performedAt)),
    savedPerformedAt: workout.performedAt,
    notes: workout.notes ?? '',
    entries: workout.exercises.map((entry) => ({
      key: nextKey++,
      exerciseId: entry.exerciseId,
      equipment: entry.equipment ?? '',
      sets: toSetDrafts(entry.sets, unit),
      // Logged sets are never swapped behind the user's back.
      pristine: false,
    })),
  };
}

/**
 * A routine day as a ready-to-log draft: its exercises in order, each with the equipment and
 * sets of the last time the user did it (its first equipment and one empty set the first
 * time).
 */
function draftFromRoutineDay(
  day: RoutineDay,
  catalog: Exercise[],
  lastSets: LastExerciseSets[],
  unit: WeightUnit,
): WorkoutDraft {
  return {
    performedAt: toInputDate(new Date()),
    notes: '',
    entries: day.exerciseIds.map((exerciseId) => {
      const options = catalog.find((e) => e.id === exerciseId)?.equipment ?? [];
      // last-sets lists the most recent equipment first.
      const latest = lastSets.find(
        (e) => e.exerciseId === exerciseId && e.equipment && options.includes(e.equipment),
      );
      const equipment = latest?.equipment ?? options[0] ?? '';
      return {
        key: nextKey++,
        exerciseId,
        equipment,
        sets: lastSetsFor(lastSets, exerciseId, equipment, unit),
        pristine: true,
      };
    }),
  };
}

function useSaveWorkout(mutationFn: (input: UpdateWorkoutRequest) => Promise<Workout>) {
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
  const { data: catalog } = useSuspenseQuery(exercisesQuery);
  // A new workout never sends null: "no routine day" is simply left out.
  const save = useSaveWorkout(({ routineDayId: dayId, ...input }) =>
    createWorkout({ ...input, ...(dayId ? { routineDayId: dayId } : {}) }),
  );
  const unit = useWeightUnit();

  return (
    <WorkoutForm
      // A different day from Next up / Other days (same route) starts from its own draft.
      key={found?.day.id ?? 'empty'}
      title="Log workout"
      submitLabel="Save workout"
      dayFillsExercises
      initial={() =>
        found
          ? draftFromRoutineDay(found.day, catalog.items, lastSets, unit)
          : { performedAt: toInputDate(new Date()), notes: '', entries: [emptyExercise()] }
      }
      initialRoutineDayId={found?.day.id}
      lastSets={lastSets}
      save={save}
      back={
        <Link to="/workouts" className="muted">
          ← Workouts
        </Link>
      }
      cancel={
        <Link to="/workouts" className="button secondary">
          Cancel
        </Link>
      }
    />
  );
}

const editRoute = getRouteApi('/_app/workouts/$workoutId/edit');

export function EditWorkoutPage() {
  const { workoutId } = editRoute.useParams();
  const { data: workout } = useSuspenseQuery(workoutQuery(workoutId));
  const save = useSaveWorkout((input) => updateWorkout(workoutId, input));
  const unit = useWeightUnit();
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
      initial={() => draftFromWorkout(workout, unit)}
      initialRoutineDayId={workout.routineDay?.id}
      save={save}
      back={back}
      cancel={cancel}
    />
  );
}

interface WorkoutFormProps {
  /** Heading; a new workout shows its routine day instead once one is chosen. */
  title: string;
  submitLabel: string;
  /**
   * Choosing a routine day loads its exercises (new workouts). Otherwise it only relabels
   * the workout (editing never swaps logged exercises).
   */
  dayFillsExercises?: boolean;
  /** Routine day the session follows; sent with the workout so the rotation advances. */
  initialRoutineDayId?: string;
  /** Lazy initial state: read once, when the form mounts. */
  initial: () => WorkoutDraft;
  /** The last sets per exercise and equipment, to re-fill when the equipment changes. */
  lastSets?: LastExerciseSets[];
  save: UseMutationResult<Workout, Error, UpdateWorkoutRequest>;
  back: ReactNode;
  cancel: ReactNode;
}

function WorkoutForm({
  title,
  submitLabel,
  dayFillsExercises = false,
  initialRoutineDayId,
  initial,
  lastSets: initialLastSets = [],
  save,
  back,
  cancel,
}: WorkoutFormProps) {
  const { data: catalog } = useSuspenseQuery(exercisesQuery);
  const { data: routines } = useSuspenseQuery(routinesQuery);
  const queryClient = useQueryClient();
  const unit = useWeightUnit();
  const [draft] = useState(initial);
  const [performedAt, setPerformedAt] = useState(draft.performedAt);
  const [notes, setNotes] = useState(draft.notes);
  const [entries, setEntries] = useState<ExerciseDraft[]>(draft.entries);
  const [lastSets, setLastSets] = useState(initialLastSets);
  // '' is "no routine day"; a day that no longer exists shows as none.
  const [routineDayId, setRoutineDayId] = useState(initialRoutineDayId ?? '');
  const selected = routines
    .flatMap((routine) => routine.days.map((day) => ({ routine, day })))
    .find(({ day }) => day.id === routineDayId);

  const chooseRoutineDay = async (dayId: string) => {
    setRoutineDayId(dayId);
    const day = routines.flatMap((r) => r.days).find((d) => d.id === dayId);
    if (!dayFillsExercises || !day) return;
    // Sets the user typed are only thrown away with their OK.
    const typed = entries.some((e) => !e.pristine);
    if (typed && !confirm(`Replace the exercises with those of ${dayLabel(day)}?`)) return;
    const dayLastSets = await queryClient.fetchQuery(lastSetsQuery(day.exerciseIds));
    setLastSets(dayLastSets);
    setEntries(draftFromRoutineDay(day, catalog.items, dayLastSets, unit).entries);
  };

  const updateEntry = (key: number, change: (entry: ExerciseDraft) => ExerciseDraft) =>
    setEntries((all) => all.map((e) => (e.key === key ? change(e) : e)));

  const updateSet = (key: number, index: number, patch: Partial<SetDraft>) =>
    updateEntry(key, (e) => ({
      ...e,
      sets: e.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)),
      pristine: false,
    }));

  const equipmentOf = (exerciseId: string): Equipment[] =>
    catalog.items.find((e) => e.id === exerciseId)?.equipment ?? [];

  const [nothingDone, setNothingDone] = useState(false);
  const [problems, setProblems] = useState<SetProblem[]>([]);
  // What each sent exercise was, to explain API errors that point at "exercises.4…".
  const [sentLabels, setSentLabels] = useState<string[]>([]);

  /** "Exercise 5 · Split Squat (Dumbbell)", as the user sees it in the form. */
  const entryLabel = (entry: ExerciseDraft) => {
    const exercise = catalog.items.find((e) => e.id === entry.exerciseId);
    const index = entries.findIndex((e) => e.key === entry.key);
    const equipment =
      entry.equipment && (exercise?.equipment.length ?? 0) > 1
        ? ` (${labelize(entry.equipment)})`
        : '';
    return `Exercise ${index + 1} · ${exercise?.name ?? 'Unknown exercise'}${equipment}`;
  };

  /** Problems the API would reject, explained in the user's terms before sending. */
  const findProblems = (done: ExerciseDraft[]): SetProblem[] =>
    done.flatMap((entry) =>
      entry.sets.flatMap((set, setIndex): SetProblem[] => {
        if (isBlankSet(set)) return [];
        const where = `${entryLabel(entry)}, set ${setIndex + 1}`;
        const found: SetProblem[] = [];
        const reps = parseDecimal(set.reps);
        if (!Number.isInteger(reps) || reps < 1 || reps > MAX_REPS) {
          found.push({
            key: entry.key,
            setIndex,
            field: 'reps',
            message: `${where}: reps must be a whole number from 1 to ${MAX_REPS} (it says "${set.reps}"). Leave reps and weight empty to skip the set.`,
          });
        }
        const weight = parseDecimal(set.weight);
        if (!Number.isFinite(weight) || weight < 0 || toKg(weight, unit) > MAX_WEIGHT_KG) {
          found.push({
            key: entry.key,
            setIndex,
            field: 'weight',
            message: `${where}: weight must be a number of 0 ${unit} or more (it says "${set.weight}"). Use 0 for bodyweight.`,
          });
        }
        return found;
      }),
    );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const done = entries.filter((e) => e.exerciseId !== '' && !isSkipped(e));
    setNothingDone(done.length === 0);
    if (done.length === 0) return;
    const found = findProblems(done);
    setProblems(found);
    if (found.length > 0) return;
    setSentLabels(done.map(entryLabel));
    const request: UpdateWorkoutRequest = {
      performedAt: performedAtFor(performedAt, draft.savedPerformedAt),
      notes: notes.trim() || undefined,
      // null takes an edited workout out of its routine day.
      routineDayId: routineDayId || null,
      exercises: done.map((e) => ({
        exerciseId: e.exerciseId,
        ...(e.equipment ? { equipment: e.equipment } : {}),
        sets: e.sets
          .filter((s) => !isBlankSet(s))
          .map((s) => ({
            reps: parseDecimal(s.reps),
            weightKg: toKg(parseDecimal(s.weight), unit),
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
          {dayFillsExercises && selected ? (
            <>
              <h1>{dayLabel(selected.day)}</h1>
              <p className="muted">{selected.routine.name}</p>
            </>
          ) : (
            <h1>{title}</h1>
          )}
        </div>
      </div>

      <div className="card grid-2">
        <label>
          Date
          <input
            type="date"
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
        {routines.length > 0 && (
          <label>
            Routine day
            <select value={routineDayId} onChange={(e) => void chooseRoutineDay(e.target.value)}>
              <option value="">No routine day</option>
              {routines.map((routine) => (
                <optgroup key={routine.id} label={routine.name}>
                  {routine.days.map((day) => (
                    <option key={day.id} value={day.id}>
                      {dayLabel(day)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        )}
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
            onChange={(e) =>
              updateEntry(entry.key, (d) => ({
                ...d,
                exerciseId: e.target.value,
                equipment: equipmentOf(e.target.value)[0] ?? '',
              }))
            }
            // Only an exercise with sets needs choosing; an empty one is just skipped.
            required={!isSkipped(entry)}
          >
            <option value="">Choose an exercise…</option>
            {catalog.items.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
          {equipmentOf(entry.exerciseId).length > 1 && (
            <div
              className="segmented"
              role="radiogroup"
              aria-label={`Equipment for exercise ${entryIndex + 1}`}
            >
              {equipmentOf(entry.exerciseId).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name={`equipment-${entry.key}`}
                    value={value}
                    checked={entry.equipment === value}
                    onChange={() =>
                      updateEntry(entry.key, (d) => ({
                        ...d,
                        equipment: value,
                        sets: d.pristine
                          ? lastSetsFor(lastSets, d.exerciseId, value, unit)
                          : d.sets,
                      }))
                    }
                  />
                  <span>{labelize(value)}</span>
                </label>
              ))}
            </div>
          )}

          {entry.exerciseId !== '' && isSkipped(entry) && (
            <p className="hint">Left empty: skipped, not saved.</p>
          )}
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
                      pristine: false,
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
                  required={!isBlankSet(set)}
                  invalid={problems.some(
                    (p) => p.key === entry.key && p.setIndex === setIndex && p.field === 'reps',
                  )}
                  onChange={(reps) => updateSet(entry.key, setIndex, { reps })}
                />
                <Stepper
                  label={`Weight (${unit})`}
                  value={set.weight}
                  step={WEIGHT_STEP[unit]}
                  min={0}
                  required={!isBlankSet(set)}
                  invalid={problems.some(
                    (p) => p.key === entry.key && p.setIndex === setIndex && p.field === 'weight',
                  )}
                  decimal
                  onChange={(weight) => updateSet(entry.key, setIndex, { weight })}
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
                return {
                  ...d,
                  sets: [...d.sets, last ? { ...last } : emptySet()],
                  pristine: false,
                };
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

      {nothingDone && (
        <div className="alert" role="alert">
          <p>Fill in at least one set to save the workout.</p>
        </div>
      )}
      {problems.length > 0 && (
        <div className="alert" role="alert">
          <p>Some sets need fixing before saving:</p>
          <ul>
            {problems.map((p) => (
              <li key={`${p.key}-${p.setIndex}-${p.field}`}>{p.message}</li>
            ))}
          </ul>
        </div>
      )}
      <ErrorMessage
        error={save.error}
        describe={(detail) => describeApiDetail(detail, sentLabels)}
      />
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
