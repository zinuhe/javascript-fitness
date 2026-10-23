import { useState, type FormEvent } from 'react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
  type UseMutationResult,
} from '@tanstack/react-query';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import type { CreateRoutineRequest, Routine } from '@fitness/contracts';
import {
  activateRoutine,
  createRoutine,
  deleteRoutine,
  exercisesQuery,
  routineQuery,
  routinesQuery,
  updateRoutine,
} from '../api/queries';
import { ErrorMessage, dayLabel, exerciseNames } from '../components/ui';

/** Routines changed: every routine query, including "next day", is stale. */
const refreshRoutines = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: ['routines'] });

// ── List ──────────────────────────────────────────────────────────────────────

export function RoutinesPage() {
  const { data: routines } = useSuspenseQuery(routinesQuery);

  return (
    <section className="stack">
      <div className="page-header">
        <h1>Routines</h1>
        <Link to="/routines/new" className="button">
          New routine
        </Link>
      </div>

      {routines.length === 0 ? (
        <div className="card empty">
          <p>No routines yet.</p>
          <p className="muted">
            A routine is a cycle of days — for example Push, Pull and Legs — that repeats in order.
            Logging a day moves you to the next one.
          </p>
          <Link to="/routines/new">Create your first routine</Link>
        </div>
      ) : (
        <ul className="list">
          {routines.map((routine) => (
            <li key={routine.id}>
              <Link
                to="/routines/$routineId"
                params={{ routineId: routine.id }}
                className="card link-card"
              >
                <div className="row between">
                  <strong>{routine.name}</strong>
                  {routine.isActive && <span className="badge">Active</span>}
                </div>
                <p className="card-meta">
                  {routine.days.length} {routine.days.length === 1 ? 'day' : 'days'}
                </p>
                <p className="muted">{routine.days.map((day) => dayLabel(day)).join(' · ')}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Detail ────────────────────────────────────────────────────────────────────

const detailRoute = getRouteApi('/_app/routines/$routineId');

export function RoutineDetailPage() {
  const { routineId } = detailRoute.useParams();
  const { data: routine } = useSuspenseQuery(routineQuery(routineId));
  const { data: catalog } = useSuspenseQuery(exercisesQuery);
  const names = exerciseNames(catalog.items);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const activate = useMutation({
    mutationFn: () => activateRoutine(routineId),
    onSuccess: () => refreshRoutines(queryClient),
  });
  const remove = useMutation({
    mutationFn: () => deleteRoutine(routineId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: routineQuery(routineId).queryKey });
      await refreshRoutines(queryClient);
      // Workouts lose their routine label.
      await queryClient.invalidateQueries({ queryKey: ['workouts'] });
      await navigate({ to: '/routines' });
    },
  });

  return (
    <section className="stack">
      <div className="detail-header">
        <div>
          <Link to="/routines" className="muted back-link">
            ← Routines
          </Link>
          <h1>{routine.name}</h1>
          <p className="muted">
            {routine.days.length} {routine.days.length === 1 ? 'day' : 'days'}, repeated in order
            {routine.isActive && ' · Active'}
          </p>
        </div>
        <div className="detail-actions">
          <Link to="/routines/$routineId/edit" params={{ routineId }} className="button secondary">
            Edit
          </Link>
          <button
            type="button"
            className="button danger"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm('Delete this routine? Your logged workouts are kept.')) remove.mutate();
            }}
          >
            Delete
          </button>
        </div>
      </div>
      {!routine.isActive && (
        <button
          type="button"
          className="button"
          disabled={activate.isPending}
          onClick={() => activate.mutate()}
        >
          {activate.isPending ? 'Activating…' : 'Follow this routine'}
        </button>
      )}
      <ErrorMessage error={activate.error ?? remove.error} />

      {routine.days.map((day) => (
        <article key={day.id} className="card stack-tight">
          <h2>{dayLabel(day)}</h2>
          <ol className="exercise-list">
            {day.exerciseIds.map((exerciseId, index) => (
              <li key={`${exerciseId}-${index}`}>
                <Link to="/exercises/$exerciseId" params={{ exerciseId }}>
                  {names.get(exerciseId) ?? 'Unknown exercise'}
                </Link>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </section>
  );
}

// ── Editor (new / edit) ───────────────────────────────────────────────────────

interface DayDraft {
  key: number;
  /** Set for days that already exist, so the API keeps them (and their history). */
  id?: string;
  name: string;
  exerciseIds: string[];
}

let nextKey = 0;
const emptyDay = (): DayDraft => ({ key: nextKey++, name: '', exerciseIds: [] });

/** Moves the item at `index` by `delta` positions (no-op at the ends). */
function move<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const copy = [...items];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

export function NewRoutinePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const save = useMutation({
    mutationFn: createRoutine,
    onSuccess: async (routine) => {
      await refreshRoutines(queryClient);
      await navigate({ to: '/routines/$routineId', params: { routineId: routine.id } });
    },
  });

  return (
    <RoutineForm
      title="New routine"
      submitLabel="Create routine"
      initialName=""
      initialDays={() => [emptyDay()]}
      save={save}
      cancelTo={null}
    />
  );
}

const editRoute = getRouteApi('/_app/routines/$routineId/edit');

export function EditRoutinePage() {
  const { routineId } = editRoute.useParams();
  const { data: routine } = useSuspenseQuery(routineQuery(routineId));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const save = useMutation({
    mutationFn: (input: CreateRoutineRequest) => updateRoutine(routineId, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(routineQuery(routineId).queryKey, updated);
      await refreshRoutines(queryClient);
      await queryClient.invalidateQueries({ queryKey: ['workouts'] });
      await navigate({ to: '/routines/$routineId', params: { routineId } });
    },
  });

  return (
    <RoutineForm
      title="Edit routine"
      submitLabel="Save changes"
      initialName={routine.name}
      initialDays={() =>
        routine.days.map((day) => ({
          key: nextKey++,
          id: day.id,
          name: day.name ?? '',
          exerciseIds: [...day.exerciseIds],
        }))
      }
      save={save}
      cancelTo={routineId}
    />
  );
}

interface RoutineFormProps {
  title: string;
  submitLabel: string;
  initialName: string;
  initialDays: () => DayDraft[];
  save: UseMutationResult<Routine, Error, CreateRoutineRequest>;
  /** Routine to return to on cancel; null goes back to the list. */
  cancelTo: string | null;
}

function RoutineForm({
  title,
  submitLabel,
  initialName,
  initialDays,
  save,
  cancelTo,
}: RoutineFormProps) {
  const { data: catalog } = useSuspenseQuery(exercisesQuery);
  const names = exerciseNames(catalog.items);
  const [name, setName] = useState(initialName);
  const [days, setDays] = useState<DayDraft[]>(initialDays);
  const [problem, setProblem] = useState<string | null>(null);

  const updateDay = (key: number, change: (day: DayDraft) => DayDraft) =>
    setDays((all) => all.map((day) => (day.key === key ? change(day) : day)));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const empty = days.findIndex((day) => day.exerciseIds.length === 0);
    if (empty !== -1) {
      setProblem(`Day ${empty + 1} needs at least one exercise.`);
      return;
    }
    setProblem(null);
    save.mutate({
      name: name.trim(),
      days: days.map((day) => ({
        ...(day.id ? { id: day.id } : {}),
        ...(day.name.trim() ? { name: day.name.trim() } : {}),
        exerciseIds: day.exerciseIds,
      })),
    });
  };

  if (catalog.items.length === 0) {
    return (
      <section className="card empty">
        <p>The exercise catalog is empty.</p>
        <Link to="/exercises">Add an exercise first</Link>
      </section>
    );
  }

  const cancel =
    cancelTo === null ? (
      <Link to="/routines" className="button secondary">
        Cancel
      </Link>
    ) : (
      <Link to="/routines/$routineId" params={{ routineId: cancelTo }} className="button secondary">
        Cancel
      </Link>
    );

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="page-header">
        <div>
          <Link to="/routines" className="muted back-link">
            ← Routines
          </Link>
          <h1>{title}</h1>
        </div>
      </div>

      <div className="card">
        <label>
          Routine name
          <input
            value={name}
            maxLength={80}
            placeholder="e.g. Push / Pull / Legs"
            autoCapitalize="words"
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
      </div>

      {days.map((day, dayIndex) => (
        <fieldset key={day.key} className="card stack" aria-labelledby={`day-${day.key}-title`}>
          <div className="row between">
            <span id={`day-${day.key}-title`} className="legend">
              Day {dayIndex + 1}
            </span>
            <div className="toolbar">
              <button
                type="button"
                className="icon-button"
                aria-label={`Move day ${dayIndex + 1} up`}
                disabled={dayIndex === 0}
                onClick={() => setDays((all) => move(all, dayIndex, -1))}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Move day ${dayIndex + 1} down`}
                disabled={dayIndex === days.length - 1}
                onClick={() => setDays((all) => move(all, dayIndex, 1))}
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove day ${dayIndex + 1}`}
                disabled={days.length === 1}
                onClick={() => setDays((all) => all.filter((d) => d.key !== day.key))}
              >
                ✕
              </button>
            </div>
          </div>
          <label>
            Day name
            <input
              value={day.name}
              maxLength={60}
              placeholder="Optional, e.g. Push"
              autoCapitalize="words"
              onChange={(e) => updateDay(day.key, (d) => ({ ...d, name: e.target.value }))}
            />
          </label>

          {day.exerciseIds.length === 0 ? (
            <p className="muted">No exercises yet.</p>
          ) : (
            <ol className="edit-list" aria-label={`Exercises of day ${dayIndex + 1}`}>
              {day.exerciseIds.map((exerciseId, index) => {
                const exerciseName = names.get(exerciseId) ?? 'Unknown exercise';
                return (
                  <li key={`${exerciseId}-${index}`}>
                    <span className="edit-list-name">{exerciseName}</span>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Move ${exerciseName} up`}
                      disabled={index === 0}
                      onClick={() =>
                        updateDay(day.key, (d) => ({
                          ...d,
                          exerciseIds: move(d.exerciseIds, index, -1),
                        }))
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Move ${exerciseName} down`}
                      disabled={index === day.exerciseIds.length - 1}
                      onClick={() =>
                        updateDay(day.key, (d) => ({
                          ...d,
                          exerciseIds: move(d.exerciseIds, index, 1),
                        }))
                      }
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${exerciseName}`}
                      onClick={() =>
                        updateDay(day.key, (d) => ({
                          ...d,
                          exerciseIds: d.exerciseIds.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          {/* Picking an option adds it right away and resets the picker (fast on a phone). */}
          <select
            aria-label={`Add exercise to day ${dayIndex + 1}`}
            value=""
            onChange={(e) => {
              const exerciseId = e.target.value;
              if (exerciseId) {
                updateDay(day.key, (d) => ({ ...d, exerciseIds: [...d.exerciseIds, exerciseId] }));
              }
            }}
          >
            <option value="">+ Add exercise…</option>
            {catalog.items.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </fieldset>
      ))}

      <button
        type="button"
        className="button secondary"
        onClick={() => setDays((all) => [...all, emptyDay()])}
      >
        + Add day
      </button>

      {problem && (
        <div className="alert" role="alert">
          <p>{problem}</p>
        </div>
      )}
      <ErrorMessage error={save.error} />
      <div className="form-actions">
        <button className="button" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : submitLabel}
        </button>
        {cancel}
      </div>
    </form>
  );
}
