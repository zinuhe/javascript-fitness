import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MuscleGroup } from '@fitness/contracts';
import { apiState, seedExercise, seedRoutine, seedWorkout } from '../test/api';
import { currentUrl, renderApp, signedInAs } from '../test/render';

function seedCatalog() {
  return {
    bench: seedExercise({ name: 'Barbell Bench Press' }),
    press: seedExercise({ name: 'Overhead Press', muscleGroup: MuscleGroup.Shoulders }),
    row: seedExercise({ name: 'Barbell Row', muscleGroup: MuscleGroup.Back }),
    squat: seedExercise({ name: 'Barbell Back Squat', muscleGroup: MuscleGroup.Legs }),
  };
}

/** The "Day N" group of the routine editor. */
const dayGroup = (n: number) => screen.getByRole('group', { name: `Day ${n}` });

describe('routines', () => {
  it('explains routines when there are none yet', async () => {
    signedInAs();
    renderApp('/routines');

    expect(await screen.findByText('No routines yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create your first routine' })).toHaveAttribute(
      'href',
      '/routines/new',
    );
  });

  it('builds a routine day by day, with ordering, and makes it the active one', async () => {
    signedInAs();
    const { bench, press, row, squat } = seedCatalog();
    const { user, router } = renderApp('/routines/new');

    await user.type(await screen.findByLabelText('Routine name'), 'Upper / Lower');
    await user.type(within(dayGroup(1)).getByLabelText('Day name'), 'Upper');
    const addToDay1 = screen.getByRole('combobox', { name: 'Add exercise to day 1' });
    await user.selectOptions(addToDay1, press.name);
    await user.selectOptions(addToDay1, bench.name);
    await user.selectOptions(addToDay1, row.name);
    // Bench first, then drop the row.
    await user.click(screen.getByRole('button', { name: `Move ${bench.name} up` }));
    await user.click(screen.getByRole('button', { name: `Remove ${row.name}` }));
    expect(
      within(screen.getByRole('list', { name: 'Exercises of day 1' }))
        .getAllByRole('listitem')
        .map((item) => item.querySelector('.edit-list-name')?.textContent),
    ).toEqual([bench.name, press.name]);

    await user.click(screen.getByRole('button', { name: '+ Add day' }));
    await user.type(within(dayGroup(2)).getByLabelText('Day name'), 'Lower');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Add exercise to day 2' }),
      squat.name,
    );
    await user.click(screen.getByRole('button', { name: 'Create routine' }));

    expect(await screen.findByRole('heading', { name: 'Upper / Lower' })).toBeInTheDocument();
    const [saved] = apiState.routines;
    expect(currentUrl(router)).toBe(`/routines/${saved.id}`);
    expect(saved.isActive).toBe(true);
    expect(saved.days.map((d) => [d.name, d.exerciseIds])).toEqual([
      ['Upper', [bench.id, press.id]],
      ['Lower', [squat.id]],
    ]);
    expect(screen.getByRole('heading', { name: 'Day 1 · Upper' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Day 2 · Lower' })).toBeInTheDocument();
  });

  it('asks for at least one exercise per day before saving', async () => {
    signedInAs();
    const { bench } = seedCatalog();
    const { user } = renderApp('/routines/new');

    await user.type(await screen.findByLabelText('Routine name'), 'PPL');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Add exercise to day 1' }),
      bench.name,
    );
    await user.click(screen.getByRole('button', { name: '+ Add day' }));
    await user.click(screen.getByRole('button', { name: 'Create routine' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Day 2 needs at least one exercise.',
    );
    expect(apiState.routines).toHaveLength(0);
  });

  it('edits a routine keeping its existing days (and their history)', async () => {
    const me = signedInAs();
    const { bench, row, squat } = seedCatalog();
    const routine = seedRoutine(me.id, {
      name: 'PPL',
      days: [
        { name: 'Push', exerciseIds: [bench.id] },
        { name: 'Pull', exerciseIds: [row.id] },
      ],
    });
    const { user } = renderApp(`/routines/${routine.id}/edit`);

    // Swap the days and add a third one.
    await user.click(await screen.findByRole('button', { name: 'Move day 2 up' }));
    await user.click(screen.getByRole('button', { name: '+ Add day' }));
    await user.type(within(dayGroup(3)).getByLabelText('Day name'), 'Legs');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Add exercise to day 3' }),
      squat.name,
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { name: 'Day 3 · Legs' })).toBeInTheDocument();
    const days = apiState.routines[0].days;
    expect(days.map((d) => d.name)).toEqual(['Pull', 'Push', 'Legs']);
    expect(days[0].id).toBe(routine.days[1].id);
    expect(days[1].id).toBe(routine.days[0].id);
  });

  it('switches the active routine and deletes one', async () => {
    const me = signedInAs();
    const { bench, squat } = seedCatalog();
    seedRoutine(me.id, { name: 'PPL', days: [{ name: 'Push', exerciseIds: [bench.id] }] });
    const second = seedRoutine(me.id, {
      name: 'Full body',
      days: [{ exerciseIds: [squat.id] }],
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user, router } = renderApp(`/routines/${second.id}`);

    await user.click(await screen.findByRole('button', { name: 'Follow this routine' }));
    await screen.findByText(/repeated in order · Active/);
    expect(apiState.routines.map((r) => [r.name, r.isActive])).toEqual([
      ['PPL', false],
      ['Full body', true],
    ]);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByRole('heading', { name: 'Routines' });
    expect(currentUrl(router)).toBe('/routines');
    expect(apiState.routines.map((r) => r.name)).toEqual(['PPL']);
  });
});

describe('starting a routine day', () => {
  it('offers the next day, pre-filled with the last sets, and advances the rotation', async () => {
    const me = signedInAs();
    const { bench, press, row } = seedCatalog();
    seedRoutine(me.id, {
      name: 'Push / Pull',
      days: [
        { name: 'Push', exerciseIds: [bench.id, press.id] },
        { name: 'Pull', exerciseIds: [row.id] },
      ],
    });
    // Bench was done before (heaviest last time); overhead press never.
    seedWorkout(me.id, {
      performedAt: '2026-10-10T09:00:00.000Z',
      exercises: [{ exerciseId: bench.id, sets: [{ reps: 8, weightKg: 55 }] }],
    });
    seedWorkout(me.id, {
      performedAt: '2026-10-17T09:00:00.000Z',
      exercises: [
        {
          exerciseId: bench.id,
          sets: [
            { reps: 8, weightKg: 60, rpe: 8 },
            { reps: 6, weightKg: 65 },
          ],
        },
      ],
    });
    const { user, router } = renderApp('/workouts');

    const tabs = await screen.findByRole('navigation', { name: 'Tabs' });
    await user.click(within(tabs).getByRole('link', { name: 'Log workout' }));
    await user.click(
      await screen.findByRole('link', { name: 'Start Day 1 · Push of Push / Pull' }),
    );

    expect(await screen.findByRole('heading', { name: 'Day 1 · Push' })).toBeInTheDocument();
    const exercise1 = screen.getByRole('group', { name: 'Exercise 1' });
    expect(within(exercise1).getByRole('combobox', { name: 'Exercise' })).toHaveValue(bench.id);
    expect(
      within(exercise1)
        .getAllByLabelText('Reps')
        .map((i) => (i as HTMLInputElement).value),
    ).toEqual(['8', '6']);
    expect(
      within(exercise1)
        .getAllByLabelText('Weight (kg)')
        .map((i) => (i as HTMLInputElement).value),
    ).toEqual(['60', '65']);
    const exercise2 = screen.getByRole('group', { name: 'Exercise 2' });
    expect(within(exercise2).getByRole('combobox', { name: 'Exercise' })).toHaveValue(press.id);
    expect(within(exercise2).getByLabelText('Weight (kg)')).toHaveValue(''); // never done

    // Push the first bench set by 2.5 kg, fill the press and save.
    await user.click(
      within(exercise1).getAllByRole('button', { name: 'Weight (kg): increase' })[0],
    );
    await user.type(within(exercise2).getByLabelText('Reps'), '6');
    await user.type(within(exercise2).getByLabelText('Weight (kg)'), '40');
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    await screen.findByRole('heading', { name: bench.name });
    const saved = apiState.workouts.at(-1)!;
    expect(currentUrl(router)).toBe(`/workouts/${saved.id}`);
    expect(saved.routineDay).toMatchObject({ name: 'Push', routineName: 'Push / Pull' });
    expect(saved.exercises[0].sets).toEqual([
      expect.objectContaining({ reps: 8, weightKg: 62.5, rpe: 8 }),
      expect.objectContaining({ reps: 6, weightKg: 65 }),
    ]);

    // The Workouts list now points at the next day and labels the session.
    await user.click(screen.getByRole('link', { name: '← Workouts' }));
    expect(
      await screen.findByRole('link', { name: 'Start Day 2 · Pull of Push / Pull' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Day 1 · Push')[0]).toBeInTheDocument();
  });

  it('lets you pick another day or an empty workout', async () => {
    const me = signedInAs();
    const { bench, row } = seedCatalog();
    seedRoutine(me.id, {
      name: 'Push / Pull',
      days: [
        { name: 'Push', exerciseIds: [bench.id] },
        { name: 'Pull', exerciseIds: [row.id] },
      ],
    });
    const { user, router } = renderApp('/workouts/start');

    const others = await screen.findByRole('list', { name: 'Other days' });
    await user.click(within(others).getByRole('link', { name: /Day 2 · Pull/ }));
    expect(await screen.findByRole('heading', { name: 'Day 2 · Pull' })).toBeInTheDocument();

    await router.navigate({ to: '/workouts/start' });
    await user.click(await screen.findByRole('link', { name: 'Empty workout' }));
    expect(await screen.findByRole('heading', { name: 'Log workout' })).toBeInTheDocument();
  });

  it('goes straight to an empty workout without an active routine', async () => {
    signedInAs();
    seedCatalog();
    const { router } = renderApp('/workouts/start');

    expect(await screen.findByRole('heading', { name: 'Log workout' })).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/workouts/new');
  });
});

describe('account', () => {
  it('shows the profile and signs out', async () => {
    signedInAs({ displayName: 'Alex', email: 'alex@example.com' });
    const { user, router } = renderApp('/account');

    const details = await screen.findByText('alex@example.com');
    expect(details).toBeInTheDocument();
    await user.click(within(screen.getByRole('main')).getByRole('button', { name: 'Sign out' }));

    await screen.findByRole('heading', { name: 'Sign in' });
    expect(currentUrl(router)).toBe('/login');
  });
});
