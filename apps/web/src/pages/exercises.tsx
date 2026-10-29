import { useState, useTransition, type FormEvent } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import {
  Equipment,
  Muscle,
  MuscleGroup,
  type CreateExerciseRequest,
  type Exercise,
  type ExerciseProgressPoint,
} from '@fitness/contracts';
import {
  createExercise,
  deleteExercise,
  exerciseCountsQuery,
  exerciseQuery,
  exercisesQuery,
  progressQuery,
  updateExercise,
} from '../api/queries';
import {
  ErrorMessage,
  equipmentLabel,
  formatSessionDate,
  formatShortDate,
  labelize,
} from '../components/ui';
import { MuscleMap } from '../components/muscle-map';
import { formatTableVolume, formatWeight, useWeightUnit } from '../components/units';

/**
 * One or more pieces of equipment as toggle chips. While none is checked every box is
 * `required`, so the browser itself asks for at least one before submitting.
 */
function EquipmentPicker({ initial = [] }: { initial?: Equipment[] }) {
  const [checked, setChecked] = useState(() => new Set(initial));
  const toggle = (value: Equipment) =>
    setChecked((current) => {
      const next = new Set(current);
      if (!next.delete(value)) next.add(value);
      return next;
    });
  return (
    <fieldset className="field-group">
      <legend>Equipment</legend>
      <div className="chips">
        {Object.values(Equipment).map((value) => (
          <label key={value}>
            <input
              type="checkbox"
              name="equipment"
              value={value}
              checked={checked.has(value)}
              required={checked.size === 0}
              onChange={() => toggle(value)}
            />
            <span>{labelize(value)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Main and secondary muscles as two groups of chips, with the map drawn as they are picked.
 * A muscle is in one group at most: picking it in one disables it in the other.
 */
function MusclePicker({ initial }: { initial?: Exercise }) {
  const [primary, setPrimary] = useState(() => initial?.primaryMuscles ?? []);
  const [secondary, setSecondary] = useState(() => initial?.secondaryMuscles ?? []);
  // In catalog order, whatever order they were ticked in.
  const toggle = (list: Muscle[], muscle: Muscle) =>
    Object.values(Muscle).filter((m) => (m === muscle ? !list.includes(m) : list.includes(m)));
  const group = (
    legend: string,
    name: string,
    chosen: Muscle[],
    other: Muscle[],
    set: (next: Muscle[]) => void,
  ) => (
    <fieldset className="field-group">
      <legend>{legend}</legend>
      <div className="chips">
        {Object.values(Muscle).map((muscle) => (
          <label key={muscle}>
            <input
              type="checkbox"
              name={name}
              value={muscle}
              checked={chosen.includes(muscle)}
              disabled={other.includes(muscle)}
              onChange={() => set(toggle(chosen, muscle))}
            />
            <span>{labelize(muscle)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
  return (
    <>
      <MuscleMap primary={primary} secondary={secondary} />
      {group('Main muscles', 'primaryMuscles', primary, secondary, setPrimary)}
      {group('Also works', 'secondaryMuscles', secondary, primary, setSecondary)}
    </>
  );
}

/** Name, muscle group, equipment and description; shared by the add and edit forms. */
function ExerciseFields({ initial }: { initial?: Exercise }) {
  return (
    <>
      <div className="grid-2">
        <label>
          Name
          <input
            name="name"
            maxLength={120}
            autoCapitalize="words"
            defaultValue={initial?.name}
            required
          />
        </label>
        <label>
          Muscle group
          <select name="muscleGroup" required defaultValue={initial?.muscleGroup ?? ''}>
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
      </div>
      <EquipmentPicker initial={initial?.equipment} />
      <MusclePicker initial={initial} />
      <label>
        Description
        <input
          name="description"
          maxLength={500}
          placeholder="Optional"
          defaultValue={initial?.description}
        />
      </label>
    </>
  );
}

/** Reads {@link ExerciseFields} back; an empty description is sent as "" to clear it. */
function readExerciseFields(form: HTMLFormElement): CreateExerciseRequest {
  const data = new FormData(form);
  return {
    name: String(data.get('name')).trim(),
    muscleGroup: data.get('muscleGroup') as MuscleGroup,
    // In catalog order, whatever order they were ticked in.
    equipment: Object.values(Equipment).filter((value) => data.getAll('equipment').includes(value)),
    description: String(data.get('description')).trim(),
    primaryMuscles: data.getAll('primaryMuscles') as Muscle[],
    secondaryMuscles: data.getAll('secondaryMuscles') as Muscle[],
  };
}

type SortKey = 'name' | 'sessions';
type CatalogSort = `${SortKey}-${'asc' | 'desc'}`;
const CATALOG_SORTS: CatalogSort[] = ['name-asc', 'name-desc', 'sessions-asc', 'sessions-desc'];

/** Each key starts in its natural direction (A–Z, most done first); a second tap flips it. */
const SORTS: { key: SortKey; label: string; first: CatalogSort; arrows: Record<string, string> }[] =
  [
    { key: 'name', label: 'Name', first: 'name-asc', arrows: { asc: '↓', desc: '↑' } },
    {
      key: 'sessions',
      label: 'Sessions',
      first: 'sessions-desc',
      arrows: { asc: '↓', desc: '↑' },
    },
  ];

/**
 * A view preference kept on this device (sort order, filters). Storage can be missing or
 * throw (private mode); the page then just starts from the default.
 */
function useStoredState<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key) as T | null;
      return saved && allowed.includes(saved) ? saved : fallback;
    } catch {
      return fallback;
    }
  });
  const update = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // Not remembered on this device; still applied now.
    }
  };
  return [value, update] as const;
}

export function ExercisesPage() {
  const { data } = useSuspenseQuery(exercisesQuery);
  const { data: counts } = useSuspenseQuery(exerciseCountsQuery);
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [formKey, setFormKey] = useState(0);
  const [sort, setSort] = useStoredState<CatalogSort>(
    'fitness.exercises.sort',
    'name-asc',
    CATALOG_SORTS,
  );
  const [sortKey, sortDir] = sort.split('-') as [SortKey, 'asc' | 'desc'];
  const [unused, setUnused] = useStoredState<'show' | 'hide'>('fitness.exercises.unused', 'show', [
    'show',
    'hide',
  ]);
  const sessions = (id: string) => counts.get(id) ?? 0;

  const create = useMutation({
    mutationFn: createExercise,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exercisesQuery.queryKey }),
  });

  const needle = query.trim().toLowerCase();
  const matching = needle
    ? data.items.filter((e) =>
        [e.name, labelize(e.muscleGroup), ...e.equipment.map(labelize)].some((text) =>
          text.toLowerCase().includes(needle),
        ),
      )
    : data.items;
  // By name or by sessions (name breaks ties), either way; never-done ones hidden on demand.
  const order = sortDir === 'asc' ? 1 : -1;
  const visible = matching
    .filter((e) => unused === 'show' || sessions(e.id) > 0)
    .sort((a, b) =>
      sortKey === 'sessions'
        ? order * (sessions(a.id) - sessions(b.id)) || a.name.localeCompare(b.name)
        : order * a.name.localeCompare(b.name),
    );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const { description, ...fields } = readExerciseFields(formElement);
    create.mutate(
      { ...fields, description: description || undefined },
      // A new key remounts the fields: reset() alone would not clear the equipment chips.
      { onSuccess: () => setFormKey((k) => k + 1) },
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

      {data.items.length > 1 && (
        <div className="catalog-tools">
          <div className="segmented" role="radiogroup" aria-label="Sort by">
            {SORTS.map(({ key, label, first, arrows }) => (
              <label key={key}>
                <input
                  type="radio"
                  name="catalogSort"
                  value={key}
                  checked={sortKey === key}
                  // A tap on the active option flips its direction (change doesn't fire then).
                  onClick={() =>
                    setSort(
                      sortKey !== key ? first : `${key}-${sortDir === 'asc' ? 'desc' : 'asc'}`,
                    )
                  }
                  onChange={() => undefined}
                  aria-description={
                    sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                />
                <span>
                  {label}
                  {sortKey === key && <span aria-hidden="true"> {arrows[sortDir]}</span>}
                </span>
              </label>
            ))}
          </div>
          <div className="chips">
            <label>
              <input
                type="checkbox"
                checked={unused === 'hide'}
                onChange={(e) => setUnused(e.target.checked ? 'hide' : 'show')}
              />
              <span>Hide 0 sessions</span>
            </label>
          </div>
        </div>
      )}

      {data.items.length === 0 ? (
        <p className="card muted empty">No exercises yet.</p>
      ) : visible.length === 0 ? (
        <p className="card muted empty">
          {matching.length > 0
            ? 'No exercises with sessions yet.'
            : `No exercises match “${query.trim()}”.`}
        </p>
      ) : (
        <ul className="card list-rows" aria-label="Exercise catalog">
          {visible.map((exercise) => (
            <li key={exercise.id}>
              <Link
                to="/exercises/$exerciseId"
                params={{ exerciseId: exercise.id }}
                className="list-row with-figure"
              >
                <MuscleMap
                  primary={exercise.primaryMuscles}
                  secondary={exercise.secondaryMuscles}
                  size="small"
                  decorative
                />
                <span className="list-row-title">{exercise.name}</span>
                <span className="list-row-meta">
                  {labelize(exercise.muscleGroup)} · {equipmentLabel(exercise.equipment)}
                </span>
                {/* How many of your workouts include it. */}
                <span className="list-row-count" aria-label={`${sessions(exercise.id)} sessions`}>
                  <strong>{sessions(exercise.id)}</strong>
                  <span>{sessions(exercise.id) === 1 ? 'session' : 'sessions'}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form className="card stack" onSubmit={onSubmit}>
        <h2>Add exercise</h2>
        <ExerciseFields key={formKey} />
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
/** "Dumbbell ×2": what a session was done with. */
function sessionEquipment(point: ExerciseProgressPoint): string {
  const name = labelize(point.equipment ?? '');
  return point.dumbbells ? `${name} ×${point.dumbbells}` : name;
}

function OneRepMaxChart({
  points,
  showEquipment = false,
}: {
  points: ExerciseProgressPoint[];
  /** Name each session's equipment in the tooltip (the "All" view). */
  showEquipment?: boolean;
}) {
  const unit = useWeightUnit();
  // The session whose sets are shown: hovered, focused or tapped.
  const [active, setActive] = useState<number | null>(null);
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
  // Barbell sets show the plates, as logged; the chart and table keep the total.
  const plates = (set: ExerciseProgressPoint['sets'][number]) => set.weightKg - (set.barKg ?? 0);
  const setLine = (set: ExerciseProgressPoint['sets'][number]) =>
    `${set.reps} × ${formatWeight(plates(set), unit)}`;
  /** "4 × 12 — 50 lb" when every set of the session was the same, else null. */
  const sameSets = (sets: ExerciseProgressPoint['sets']) =>
    sets.every((s) => s.reps === sets[0].reps && plates(s) === plates(sets[0]))
      ? `${sets.length} × ${sets[0].reps} — ${formatWeight(plates(sets[0]), unit)}`
      : null;
  const setsSummary = (sets: ExerciseProgressPoint['sets']) =>
    sameSets(sets) ?? sets.map(setLine).join(', ');
  const shown = active === null ? null : points[active];

  return (
    <figure className="chart">
      <div className="chart-plot">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Estimated 1RM from ${formatWeight(values[0], unit)} to ${formatWeight(values[values.length - 1], unit)}`}
        >
          <polyline points={path} className="chart-line" />
          {points.map((p, i) => (
            <circle
              key={p.performedAt}
              cx={x(i)}
              cy={y(p.estimatedOneRepMaxKg)}
              r={3.5}
              className={i === active ? 'active' : undefined}
            />
          ))}
          {/* Larger invisible targets, easy to hover, focus or tap. */}
          {points.map((p, i) => (
            <circle
              key={`hit-${p.performedAt}`}
              cx={x(i)}
              cy={y(p.estimatedOneRepMaxKg)}
              r={12}
              className="chart-hit"
              tabIndex={0}
              role="button"
              aria-label={`${formatSessionDate(p.performedAt)}: ${setsSummary(p.sets)}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => setActive((current) => (current === i ? null : i))}
            />
          ))}
        </svg>
        {shown && active !== null && (
          <div
            className="chart-tip"
            role="tooltip"
            style={{
              left: `${(x(active) / width) * 100}%`,
              top: `${(y(shown.estimatedOneRepMaxKg) / height) * 100}%`,
              // Kept inside the card near its edges.
              translate: `${active === 0 ? '-12px' : active === points.length - 1 ? 'calc(-100% + 12px)' : '-50%'} calc(-100% - 12px)`,
            }}
          >
            <strong>{formatSessionDate(shown.performedAt)}</strong>
            {showEquipment && shown.equipment && (
              <span className="chart-tip-note">{sessionEquipment(shown)}</span>
            )}
            {shown.sets.some((s) => s.barKg !== undefined) && (
              <span className="chart-tip-note">Plates only, without the bar</span>
            )}
            {sameSets(shown.sets) ? (
              <p className="chart-tip-same">{sameSets(shown.sets)}</p>
            ) : (
              <ol>
                {shown.sets.map((set, i) => (
                  <li key={i}>{setLine(set)}</li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
      <figcaption className="chart-axis">
        <span>{formatShortDate(points[0].performedAt)}</span>
        <span>Est. 1RM</span>
        <span>{formatShortDate(points[points.length - 1].performedAt)}</span>
      </figcaption>
    </figure>
  );
}

/** The muscle map of an exercise with the muscles named under it. */
function MusclesWorked({ exercise }: { exercise: Exercise }) {
  const { primaryMuscles: primary, secondaryMuscles: secondary } = exercise;
  if (primary.length + secondary.length === 0) return null;
  return (
    <div className="stack-tight">
      <MuscleMap primary={primary} secondary={secondary} />
      <p className="muscle-legend">
        {primary.length > 0 && <span>{primary.map(labelize).join(', ')}</span>}
        {secondary.length > 0 && <span className="also">{secondary.map(labelize).join(', ')}</span>}
      </p>
    </div>
  );
}

const detailRoute = getRouteApi('/_app/exercises/$exerciseId');

export function ExerciseDetailPage() {
  const { exerciseId } = detailRoute.useParams();
  const { data: exercise } = useSuspenseQuery(exerciseQuery(exerciseId));
  // undefined is "All": every session, whatever the equipment.
  const [equipment, setEquipment] = useState<Equipment | undefined>(undefined);
  const severalEquipment = exercise.equipment.length > 1;
  // A transition keeps the current numbers on screen while the other equipment loads.
  const [switching, startSwitch] = useTransition();
  const { data: progress } = useSuspenseQuery(progressQuery(exerciseId, equipment));
  const unit = useWeightUnit();
  const points = [...progress.points].reverse(); // newest first
  const best = Math.max(0, ...progress.points.map((p) => p.estimatedOneRepMaxKg));
  const heaviest = Math.max(0, ...progress.points.map((p) => p.bestSetWeightKg));
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const remove = useMutation({
    mutationFn: () => deleteExercise(exerciseId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: exerciseQuery(exerciseId).queryKey });
      await queryClient.invalidateQueries({ queryKey: exercisesQuery.queryKey });
      await navigate({ to: '/exercises' });
    },
  });

  return (
    <section className="stack">
      <div className="detail-header">
        <div>
          <Link to="/exercises" className="muted back-link">
            ← Exercises
          </Link>
          <h1>{exercise.name}</h1>
          <p className="row">
            <span className="tag">{labelize(exercise.muscleGroup)}</span>
            {exercise.equipment.map((value) => (
              <span key={value} className="tag">
                {labelize(value)}
              </span>
            ))}
          </p>
          {exercise.description && <p>{exercise.description}</p>}
          <MusclesWorked exercise={exercise} />
        </div>
        <div className="detail-actions">
          <Link
            to="/exercises/$exerciseId/edit"
            params={{ exerciseId }}
            className="button secondary"
          >
            Edit
          </Link>
          <button
            type="button"
            className="button danger"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm(`Delete "${exercise.name}" from the catalog?`)) remove.mutate();
            }}
          >
            Delete
          </button>
        </div>
      </div>
      {/* 409 when workouts or routines use it: the API explains why. */}
      <ErrorMessage error={remove.error} />

      <div className="card stack" aria-busy={switching}>
        <h2>Your progress</h2>
        {severalEquipment && (
          <div className="segmented" role="radiogroup" aria-label="Progress with">
            {[undefined, ...exercise.equipment].map((value) => (
              <label key={value ?? 'all'}>
                <input
                  type="radio"
                  name="progressEquipment"
                  value={value ?? 'all'}
                  checked={equipment === value}
                  onChange={() => startSwitch(() => setEquipment(value))}
                />
                <span>{value ? labelize(value) : 'All'}</span>
              </label>
            ))}
          </div>
        )}
        {points.length === 0 ? (
          <p className="muted">
            No sets logged for this exercise
            {equipment ? ` with ${labelize(equipment).toLowerCase()}` : ''} yet.{' '}
            <Link to="/workouts/new">Log a workout</Link>
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
            {progress.points.length > 1 && (
              <OneRepMaxChart
                points={progress.points}
                showEquipment={severalEquipment && !equipment}
              />
            )}
            <table className="compact">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Session</th>
                  <th>Volume</th>
                  <th>Top set</th>
                  <th>Est. 1RM</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point, index) => (
                  <tr key={point.performedAt}>
                    {/* Session number: the oldest is 1 (rows are newest first). */}
                    <td className="muted">{points.length - index}</td>
                    <td className="wrap-on-phone">
                      <Link to="/workouts/$workoutId" params={{ workoutId: point.workoutId }}>
                        {formatSessionDate(point.performedAt)}
                      </Link>
                      {/* On "All", what each session was done with. */}
                      {severalEquipment && !equipment && point.equipment && (
                        <span className="hint cell-note">{sessionEquipment(point)}</span>
                      )}
                    </td>
                    <td className="wrap-on-phone">
                      <span className="nowrap">
                        {formatTableVolume(point.totalVolumeKg, unit).main}
                      </span>{' '}
                      <span className="hint other-unit">
                        ({formatTableVolume(point.totalVolumeKg, unit).other})
                      </span>
                    </td>
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

const editRoute = getRouteApi('/_app/exercises/$exerciseId/edit');

export function EditExercisePage() {
  const { exerciseId } = editRoute.useParams();
  const { data: exercise } = useSuspenseQuery(exerciseQuery(exerciseId));
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const save = useMutation({
    mutationFn: (input: CreateExerciseRequest) => updateExercise(exerciseId, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(exerciseQuery(exerciseId).queryKey, updated);
      await queryClient.invalidateQueries({ queryKey: exercisesQuery.queryKey });
      await navigate({ to: '/exercises/$exerciseId', params: { exerciseId } });
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate(readExerciseFields(event.currentTarget));
  };

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div>
        <Link to="/exercises/$exerciseId" params={{ exerciseId }} className="muted back-link">
          ← {exercise.name}
        </Link>
        <h1>Edit exercise</h1>
      </div>
      <div className="card stack">
        <ExerciseFields initial={exercise} />
      </div>
      <p className="muted">
        Changes apply everywhere the exercise is used: past workouts, routines and progress.
      </p>
      <ErrorMessage error={save.error} />
      <div className="form-actions">
        <button className="button" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save changes'}
        </button>
        <Link to="/exercises/$exerciseId" params={{ exerciseId }} className="button secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
