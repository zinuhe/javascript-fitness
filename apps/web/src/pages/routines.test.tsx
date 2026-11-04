import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Equipment, MuscleGroup } from '@fitness/contracts';
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

/** The exercise picker inside the workout form's "Exercise N" group. */
async function exerciseSelect(n: number) {
  const group = await screen.findByRole('group', { name: `Exercise ${n}` });
  return within(group).getByRole('combobox', { name: 'Exercise' });
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

  it('starts with the equipment used last time and re-fills the sets when it changes', async () => {
    const me = signedInAs();
    const press = seedExercise({
      name: 'Bench Press',
      equipment: [Equipment.Cable, Equipment.Dumbbell],
    });
    seedRoutine(me.id, { name: 'Push', days: [{ name: 'Push', exerciseIds: [press.id] }] });
    seedWorkout(me.id, {
      performedAt: '2026-10-01T09:00:00.000Z',
      exercises: [
        { exerciseId: press.id, equipment: Equipment.Cable, sets: [{ reps: 5, weightKg: 80 }] },
      ],
    });
    seedWorkout(me.id, {
      performedAt: '2026-10-08T09:00:00.000Z',
      exercises: [
        { exerciseId: press.id, equipment: Equipment.Dumbbell, sets: [{ reps: 10, weightKg: 30 }] },
      ],
    });
    const { user } = renderApp('/workouts/start');

    await user.click(await screen.findByRole('link', { name: 'Start Day 1 · Push of Push' }));

    const equipment = await screen.findByRole('radiogroup', { name: 'Equipment for exercise 1' });
    const weight = () => screen.getByLabelText('Weight (kg)');
    expect(within(equipment).getByRole('radio', { name: 'Dumbbell' })).toBeChecked();
    expect(weight()).toHaveValue('30');
    expect(screen.getByLabelText('Reps')).toHaveValue('10');

    await user.click(within(equipment).getByRole('radio', { name: 'Cable' }));
    expect(weight()).toHaveValue('80');
    expect(screen.getByLabelText('Reps')).toHaveValue('5');

    // Once typed over, switching keeps what was typed.
    await user.clear(weight());
    await user.type(weight(), '85');
    await user.click(within(equipment).getByRole('radio', { name: 'Dumbbell' }));
    expect(weight()).toHaveValue('85');
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    await screen.findByRole('heading', { name: /^Bench Press/ });
    expect(apiState.workouts.at(-1)!.exercises[0]).toMatchObject({
      equipment: Equipment.Dumbbell,
      sets: [expect.objectContaining({ reps: 5, weightKg: 85 })],
    });
  });

  it('starts a routine day with as many dumbbells as last time', async () => {
    const me = signedInAs();
    const row = seedExercise({ name: 'Single-Arm Row', equipment: [Equipment.Dumbbell] });
    seedRoutine(me.id, { name: 'Pull', days: [{ name: 'Pull', exerciseIds: [row.id] }] });
    seedWorkout(me.id, {
      exercises: [{ exerciseId: row.id, dumbbells: 1, sets: [{ reps: 10, weightKg: 20 }] }],
    });
    const { user } = renderApp('/workouts/start');

    await user.click(await screen.findByRole('link', { name: 'Start Day 1 · Pull of Pull' }));

    const dumbbells = await screen.findByRole('radiogroup', { name: 'Dumbbells for exercise 1' });
    expect(within(dumbbells).getByRole('radio', { name: '1 dumbbell' })).toBeChecked();
  });

  it('pre-fills the last sets in pounds when that is the unit', async () => {
    const me = signedInAs({ weightUnit: 'lb' });
    const { bench } = seedCatalog();
    seedRoutine(me.id, { name: 'Push', days: [{ name: 'Push', exerciseIds: [bench.id] }] });
    seedWorkout(me.id, {
      exercises: [{ exerciseId: bench.id, sets: [{ reps: 8, weightKg: 22.68 }] }],
    });
    const { user } = renderApp('/workouts/start');

    await user.click(await screen.findByRole('link', { name: 'Start Day 1 · Push of Push' }));

    expect(await screen.findByLabelText('Weight (lb)')).toHaveValue('50');
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

  it('logs past sessions of any day by choosing it in the form', async () => {
    const me = signedInAs();
    const { bench, press, row } = seedCatalog();
    seedRoutine(me.id, {
      name: 'Push / Pull',
      days: [
        { name: 'Push', exerciseIds: [bench.id, press.id] },
        { name: 'Pull', exerciseIds: [row.id] },
      ],
    });
    seedWorkout(me.id, {
      performedAt: '2026-10-10T09:00:00.000Z',
      exercises: [{ exerciseId: row.id, sets: [{ reps: 10, weightKg: 50 }] }],
    });
    const { user } = renderApp('/workouts/new');

    const date = await screen.findByLabelText('Date');
    expect(date).toHaveAttribute('type', 'date'); // the day only, no time
    fireEvent.change(date, { target: { value: '2026-09-02' } });
    await user.selectOptions(screen.getByLabelText('Routine day'), 'Day 2 · Pull');

    expect(await screen.findByRole('heading', { name: 'Day 2 · Pull' })).toBeInTheDocument();
    expect(screen.getAllByRole('group', { name: /^Exercise/ })).toHaveLength(1);
    expect(await exerciseSelect(1)).toHaveValue(row.id);
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue('50'); // last time
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    await screen.findByRole('heading', { name: row.name });
    const saved = apiState.workouts.at(-1)!;
    expect(saved.routineDay).toMatchObject({ name: 'Pull' });
    // A past day is stored at noon, safe from time-zone shifts.
    expect(saved.performedAt).toBe(new Date('2026-09-02T12:00').toISOString());
  });

  it('saves a day with some exercises left empty, skipping them', async () => {
    const me = signedInAs();
    const { bench, press, row } = seedCatalog();
    seedRoutine(me.id, {
      name: 'Push',
      days: [{ name: 'Push', exerciseIds: [bench.id, press.id, row.id] }],
    });
    const { user } = renderApp('/workouts/new');

    await user.selectOptions(await screen.findByLabelText('Routine day'), 'Day 1 · Push');
    const exercise1 = await screen.findByRole('group', { name: 'Exercise 1' });
    await user.type(within(exercise1).getByLabelText('Reps'), '8');
    // Weight is then needed too: a half-typed set is not "empty".
    expect(within(exercise1).getByLabelText('Weight (kg)')).toBeRequired();
    await user.type(within(exercise1).getByLabelText('Weight (kg)'), '60');
    const exercise2 = screen.getByRole('group', { name: 'Exercise 2' });
    expect(within(exercise2).getByText('Left empty: skipped, not saved.')).toBeInTheDocument();
    expect(within(exercise2).getByLabelText('Reps')).not.toBeRequired();
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    await screen.findByRole('heading', { name: bench.name });
    const saved = apiState.workouts.at(-1)!;
    expect(saved.exercises.map((e) => e.exerciseId)).toEqual([bench.id]);
    expect(saved.routineDay).toMatchObject({ name: 'Push' });
  });

  it('needs at least one set to save', async () => {
    signedInAs();
    const { bench } = seedCatalog();
    const { user } = renderApp('/workouts/new');

    await user.selectOptions(await exerciseSelect(1), bench.name);
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Fill in at least one set to save the workout.',
    );
    expect(apiState.workouts).toHaveLength(0);
  });

  it('asks before a routine day replaces sets already typed', async () => {
    const me = signedInAs();
    const { bench, row } = seedCatalog();
    seedRoutine(me.id, {
      name: 'Push / Pull',
      days: [
        { name: 'Push', exerciseIds: [bench.id] },
        { name: 'Pull', exerciseIds: [row.id] },
      ],
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = renderApp('/workouts/new');

    await user.selectOptions(await exerciseSelect(1), bench.name);
    await user.type(screen.getByLabelText('Reps'), '8');
    await user.selectOptions(screen.getByLabelText('Routine day'), 'Day 2 · Pull');

    expect(confirm).toHaveBeenCalledWith('Replace the exercises with those of Day 2 · Pull?');
    // Declined: the day is set, the typed exercise stays.
    expect(await exerciseSelect(1)).toHaveValue(bench.id);
    expect(screen.getByLabelText('Reps')).toHaveValue('8');
    expect(screen.getByRole('heading', { name: 'Day 2 · Pull' })).toBeInTheDocument();
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
  it('switches the weight unit for the whole app', async () => {
    const me = signedInAs();
    const { bench } = seedCatalog();
    seedWorkout(me.id, {
      exercises: [{ exerciseId: bench.id, sets: [{ reps: 5, weightKg: 100 }] }],
    });
    const { user, router } = renderApp('/account');

    const kg = await screen.findByRole('radio', { name: 'Kilograms (kg)' });
    expect(kg).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Pounds (lb)' }));

    expect(await screen.findByRole('radio', { name: 'Pounds (lb)' })).toBeChecked();
    expect(apiState.users[0].weightUnit).toBe('lb');

    await router.navigate({ to: '/exercises/$exerciseId', params: { exerciseId: bench.id } });
    const best = (await screen.findByText('Heaviest set')).closest('div');
    expect(best).toHaveTextContent('220.5 lb');
  });

  it('opens from the user name in the desktop top bar', async () => {
    signedInAs({ displayName: 'Alex' });
    const { user, router } = renderApp('/workouts');

    await user.click(await screen.findByRole('link', { name: 'Account: Alex' }));

    expect(await screen.findByText('alex@example.com')).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/account');
  });

  it('lists the latest changes and where they came from, newest first', async () => {
    const me = signedInAs();
    const { bench } = seedCatalog();
    seedRoutine(me.id, { name: 'Push', days: [{ name: 'Push', exerciseIds: [bench.id] }] });
    const { user, router } = renderApp('/account');

    expect(await screen.findByText('Nothing logged yet.')).toBeInTheDocument();

    await router.navigate({ to: '/workouts/new' });
    await user.selectOptions(await screen.findByLabelText('Routine day'), 'Day 1 · Push');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-16' } });
    await user.type(await screen.findByLabelText('Reps'), '8');
    await user.type(screen.getByLabelText('Weight (kg)'), '60');
    await user.click(screen.getByRole('button', { name: 'Save workout' }));
    await screen.findByRole('heading', { name: bench.name });
    await router.navigate({ to: '/account' });

    const log = await screen.findByRole('list', { name: 'Activity' });
    const [line] = within(log).getAllByRole('listitem');
    expect(line).toHaveTextContent(/^Added workout · Day 1 · Push · Jul 16, 2026Web · /);
  });

  it('opens Help, in English or Spanish, with worked examples', async () => {
    signedInAs();
    const { user, router } = renderApp('/account');

    // The card in Account (the top bar also links Help on wide screens).
    await user.click(within(await screen.findByRole('main')).getByRole('link', { name: /^Help/ }));
    expect(await screen.findByRole('heading', { name: 'Help' })).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/help');
    expect(screen.getByText('Estimated 1RM = weight × (1 + reps ÷ 30)')).toBeInTheDocument();
    expect(screen.getByText('50 × (1 + 12 ÷ 30) = 50 × 1.4 = 70 lb')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Español' }));
    expect(screen.getByRole('heading', { name: 'Ayuda' })).toBeInTheDocument();
    expect(screen.getByText('1RM estimado = peso × (1 + reps ÷ 30)')).toBeInTheDocument();
  });

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
