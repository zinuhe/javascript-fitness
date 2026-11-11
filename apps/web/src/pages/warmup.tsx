import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import type { Exercise } from '@fitness/contracts';
import { createExercise, exercisesQuery, nextRoutineQuery } from '../api/queries';
import {
  ErrorMessage,
  dayLabel,
  labelize,
  useScrollToOnOpen,
  warmupExercises,
} from '../components/ui';
import { ExerciseThumb } from '../components/exercise-images';
import { MuscleMap } from '../components/muscle-map';
import { CatalogTabs, ExerciseFields, readExerciseFields } from './exercises';

const warmupRoute = getRouteApi('/_app/exercises/warmup');

/** Element id of a routine day's section; `?day=` opens the guide scrolled to it. */
export const warmupDayAnchor = (dayId: string) => `warmup-${dayId}`;

/** "1. Cat-Cow", how much and the muscles, the first lines of how to do it; opens the exercise. */
function WarmupRow({ exercise, position }: { exercise: Exercise; position?: number }) {
  const muscles =
    exercise.primaryMuscles.length > 0
      ? exercise.primaryMuscles.map(labelize).join(', ')
      : labelize(exercise.muscleGroup);
  return (
    <li>
      <Link
        to="/exercises/$exerciseId"
        params={{ exerciseId: exercise.id }}
        className="list-row with-figure warmup-row"
      >
        {exercise.images.length > 0 ? (
          <ExerciseThumb exercise={exercise} />
        ) : (
          <MuscleMap
            primary={exercise.primaryMuscles}
            secondary={exercise.secondaryMuscles}
            size="small"
            decorative
          />
        )}
        <span className="list-row-title">
          {position !== undefined && `${position}. `}
          {exercise.name}
        </span>
        <span className="list-row-meta">
          {[exercise.dose, muscles].filter(Boolean).join(' · ')}
        </span>
        {exercise.description && <span className="list-row-note">{exercise.description}</span>}
      </Link>
    </li>
  );
}

/**
 * The warm-up guide: what to do before each day of the active routine, then every warm-up
 * exercise. Nothing here is logged.
 */
export function WarmupPage() {
  const { day: openDay } = warmupRoute.useSearch();
  const { data: catalog } = useSuspenseQuery(exercisesQuery);
  const { data: next } = useSuspenseQuery(nextRoutineQuery);
  const queryClient = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const warmups = warmupExercises(catalog.items).sort((a, b) => a.name.localeCompare(b.name));
  const byId = new Map(warmups.map((e) => [e.id, e]));
  useScrollToOnOpen(openDay ? warmupDayAnchor(openDay) : undefined);

  const create = useMutation({
    mutationFn: createExercise,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exercisesQuery.queryKey }),
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { description, dose, ...fields } = readExerciseFields(event.currentTarget);
    create.mutate(
      { ...fields, warmup: true, description: description || undefined, dose: dose || undefined },
      // A new key remounts the fields: reset() alone would not clear the equipment chips.
      { onSuccess: () => setFormKey((k) => k + 1) },
    );
  };

  return (
    <section className="stack">
      <h1>Warm-up</h1>
      <CatalogTabs />
      <p className="muted">What to do before each session. A guide only: it is never logged.</p>

      {next?.routine.days.map((day) => {
        const exercises = day.warmupExerciseIds.flatMap((id) => byId.get(id) ?? []);
        return (
          <section
            key={day.id}
            id={warmupDayAnchor(day.id)}
            className="stack-tight scroll-target"
            aria-labelledby={`${warmupDayAnchor(day.id)}-title`}
          >
            <h2 id={`${warmupDayAnchor(day.id)}-title`} className="row">
              {dayLabel(day)}
              {day.id === next.day.id && (
                <>
                  {' '}
                  <span className="tag">Next up</span>
                </>
              )}
            </h2>
            {exercises.length === 0 ? (
              <p className="card muted empty">
                No warm-up for this day yet.{' '}
                <Link to="/routines/$routineId/edit" params={{ routineId: next.routine.id }}>
                  Choose it in the routine
                </Link>
              </p>
            ) : (
              <ul className="card list-rows" aria-label={`Warm-up for ${dayLabel(day)}`}>
                {exercises.map((exercise, index) => (
                  <WarmupRow
                    key={`${exercise.id}-${index}`}
                    exercise={exercise}
                    position={index + 1}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section className="stack-tight" aria-labelledby="all-warmups-title">
        <h2 id="all-warmups-title">All warm-up exercises</h2>
        {warmups.length === 0 ? (
          <p className="card muted empty">
            No warm-up exercises yet. Add them below, then choose each day’s in its routine.
          </p>
        ) : (
          <ul className="card list-rows" aria-label="Warm-up exercises">
            {warmups.map((exercise) => (
              <WarmupRow key={exercise.id} exercise={exercise} />
            ))}
          </ul>
        )}
      </section>

      <form className="card stack" onSubmit={onSubmit}>
        <h2>Add warm-up exercise</h2>
        <ExerciseFields key={formKey} warmup />
        <ErrorMessage error={create.error} />
        <div className="row">
          <button className="button" disabled={create.isPending}>
            {create.isPending ? 'Adding…' : 'Add warm-up exercise'}
          </button>
        </div>
      </form>
    </section>
  );
}
