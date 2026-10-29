import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Equipment, MuscleGroup } from '@fitness/contracts';
import { apiState, expireAccessTokens, seedExercise, seedRoutine, seedWorkout } from '../test/api';
import { currentUrl, renderApp, signedInAs } from '../test/render';
import { server } from '../test/setup';
import { HttpResponse, http } from 'msw';

/** The exercise picker inside the form's "Exercise N" group. */
async function exerciseSelect(n: number) {
  const group = await screen.findByRole('group', { name: `Exercise ${n}` });
  return within(group).getByRole('combobox', { name: 'Exercise' });
}

function seedCatalog() {
  return {
    squat: seedExercise({
      name: 'Barbell Back Squat',
      muscleGroup: MuscleGroup.Legs,
      equipment: [Equipment.Machine],
    }),
    bench: seedExercise({ name: 'Barbell Bench Press' }),
  };
}

describe('workouts list', () => {
  it('shows an empty state with a link to log the first session', async () => {
    signedInAs();
    renderApp('/workouts');

    expect(await screen.findByText('No workouts logged yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log your first session' })).toHaveAttribute(
      'href',
      '/workouts/new',
    );
  });

  it('summarises each session with exercise names, set count and volume', async () => {
    const me = signedInAs();
    const { squat, bench } = seedCatalog();
    seedWorkout(me.id, {
      performedAt: '2026-10-18T09:00:00.000Z',
      notes: 'Felt strong',
      exercises: [
        {
          exerciseId: squat.id,
          sets: [
            { reps: 5, weightKg: 100 },
            { reps: 5, weightKg: 110 },
          ],
        },
        { exerciseId: bench.id, sets: [{ reps: 8, weightKg: 60 }] },
      ],
    });

    renderApp('/workouts');

    const card = (await screen.findByText('Felt strong')).closest('a')!;
    // Every exercise with its equipment, and the full date.
    expect(card).toHaveTextContent('Barbell Back Squat (Machine) · Barbell Bench Press (Machine)');
    expect(card).toHaveTextContent(/Sunday.*October.*18.*2026/);
    expect(card).toHaveTextContent('3 sets · Volume 1,530 kg'); // 500 + 550 + 480
  });

  it('only lists the signed-in user’s workouts', async () => {
    const me = signedInAs();
    const { squat } = seedCatalog();
    seedWorkout('someone-else', {
      notes: 'Not mine',
      exercises: [{ exerciseId: squat.id, sets: [{ reps: 1, weightKg: 200 }] }],
    });
    seedWorkout(me.id, {
      notes: 'Mine',
      exercises: [{ exerciseId: squat.id, sets: [{ reps: 1, weightKg: 100 }] }],
    });

    renderApp('/workouts');

    expect(await screen.findByText('Mine')).toBeInTheDocument();
    expect(screen.queryByText('Not mine')).not.toBeInTheDocument();
  });

  it('paginates with newer/older links', async () => {
    const me = signedInAs();
    const { squat } = seedCatalog();
    for (let day = 1; day <= 22; day++) {
      seedWorkout(me.id, {
        performedAt: `2026-10-${String(day).padStart(2, '0')}T09:00:00.000Z`,
        notes: `Session ${day}`,
        exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100 }] }],
      });
    }
    const { user, router } = renderApp('/workouts');

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Session 22')).toBeInTheDocument(); // newest first, 20 a page
    expect(screen.queryByText('Session 2')).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Older →' }));

    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/workouts?page=2');
    expect(screen.getByText('Session 1')).toBeInTheDocument();
  });
});

describe('logging a workout', () => {
  it('submits exercises and sets, then opens the saved session', async () => {
    signedInAs();
    const { squat, bench } = seedCatalog();
    const { user, router } = renderApp('/workouts/new');

    await user.selectOptions(await exerciseSelect(1), squat.name);
    await user.type(screen.getByLabelText('Reps'), '5');
    await user.type(screen.getByLabelText('Weight (kg)'), '100');
    // A new set starts as a copy of the previous one; bump its weight.
    await user.click(screen.getByRole('button', { name: '+ Add set' }));
    const weights = screen.getAllByLabelText('Weight (kg)');
    expect(weights[1]).toHaveValue('100');
    await user.clear(weights[1]);
    await user.type(weights[1], '110');

    await user.click(screen.getByRole('button', { name: '+ Add exercise' }));
    await user.selectOptions(await exerciseSelect(2), bench.name);
    const exercise2 = screen.getByRole('group', { name: 'Exercise 2' });
    await user.type(within(exercise2).getByLabelText('Reps'), '8');
    await user.type(within(exercise2).getByLabelText('Weight (kg)'), '60');
    await user.type(screen.getByLabelText('Notes'), 'Leg day');

    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    await screen.findByRole('heading', { name: squat.name });
    const [saved] = apiState.workouts;
    expect(currentUrl(router)).toBe(`/workouts/${saved.id}`);
    expect(saved.notes).toBe('Leg day');
    expect(saved.exercises.map((e) => [e.exerciseId, e.sets])).toEqual([
      [
        squat.id,
        [
          expect.objectContaining({ reps: 5, weightKg: 100 }),
          expect.objectContaining({ reps: 5, weightKg: 110 }),
        ],
      ],
      [bench.id, [expect.objectContaining({ reps: 8, weightKg: 60 })]],
    ]);
    expect(screen.getByText('Volume 1,050 kg (2,314.9 lb)')).toBeInTheDocument();
  });

  it('asks which equipment was used only for exercises that have several', async () => {
    signedInAs();
    const { squat } = seedCatalog();
    const press = seedExercise({
      name: 'Bench Press',
      equipment: [Equipment.Barbell, Equipment.Dumbbell],
    });
    const { user } = renderApp('/workouts/new');

    await user.selectOptions(await exerciseSelect(1), squat.name);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();

    await user.selectOptions(await exerciseSelect(1), press.name);
    const equipment = screen.getByRole('radiogroup', { name: 'Equipment for exercise 1' });
    expect(within(equipment).getByRole('radio', { name: 'Barbell' })).toBeChecked();
    // Only with dumbbells: how many, two unless changed.
    expect(screen.queryByRole('radiogroup', { name: 'Dumbbells for exercise 1' })).toBeNull();
    await user.click(within(equipment).getByRole('radio', { name: 'Dumbbell' }));
    const dumbbells = screen.getByRole('radiogroup', { name: 'Dumbbells for exercise 1' });
    expect(within(dumbbells).getByRole('radio', { name: '2 dumbbells' })).toBeChecked();
    await user.click(within(dumbbells).getByRole('radio', { name: '1 dumbbell' }));
    await user.type(screen.getByLabelText('Reps'), '10');
    await user.type(screen.getByLabelText('Weight (kg)'), '30');
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    const heading = await screen.findByRole('heading', { name: 'Bench Press' });
    expect(
      within(heading.closest('article')!).getByLabelText('Equipment: Dumbbell ×1'),
    ).toHaveClass('tag');
    expect(apiState.workouts[0].exercises[0]).toMatchObject({
      exerciseId: press.id,
      equipment: Equipment.Dumbbell,
      dumbbells: 1,
    });

    await user.click(screen.getByRole('link', { name: '← Workouts' }));
    expect(await screen.findByText('Bench Press (Dumbbell ×1)')).toBeInTheDocument();
  });

  it('allows one workout per date, warning as soon as a taken date is picked', async () => {
    const me = signedInAs();
    const { squat } = seedCatalog();
    const existing = seedWorkout(me.id, {
      performedAt: new Date('2026-09-02T12:00').toISOString(),
      exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100 }] }],
    });
    const { user, router } = renderApp('/workouts/new');

    const date = await screen.findByLabelText('Date');
    fireEvent.change(date, { target: { value: '2026-09-02' } });
    const warning = await screen.findByRole('alert');
    expect(warning).toHaveTextContent(
      'You already logged a workout on Wed 2 Sep 2026. Edit that one or pick another date.',
    );
    expect(within(warning).getByRole('link', { name: 'Edit that one' })).toHaveAttribute(
      'href',
      `/workouts/${existing.id}/edit`,
    );
    expect(date).toHaveAttribute('aria-invalid', 'true');

    // Save does not go through while the date is taken.
    await user.selectOptions(await exerciseSelect(1), squat.name);
    await user.type(screen.getByLabelText('Reps'), '5');
    await user.type(screen.getByLabelText('Weight (kg)'), '100');
    await user.click(screen.getByRole('button', { name: 'Save workout' }));
    expect(apiState.workouts).toHaveLength(1);
    expect(currentUrl(router)).toBe('/workouts/new');

    // A free date clears the warning and saves.
    fireEvent.change(date, { target: { value: '2026-09-03' } });
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Save workout' }));
    await screen.findByRole('heading', { name: squat.name });
    expect(apiState.workouts).toHaveLength(2);
  });

  it('lets a workout keep its own date when edited, but not move onto a taken one', async () => {
    const me = signedInAs();
    const { squat } = seedCatalog();
    const sets = [{ reps: 5, weightKg: 100 }];
    seedWorkout(me.id, {
      performedAt: new Date('2026-09-02T12:00').toISOString(),
      exercises: [{ exerciseId: squat.id, sets }],
    });
    const other = seedWorkout(me.id, {
      performedAt: new Date('2026-09-05T12:00').toISOString(),
      exercises: [{ exerciseId: squat.id, sets }],
    });
    renderApp(`/workouts/${other.id}/edit`);

    const date = await screen.findByLabelText('Date');
    await waitFor(() => expect(date).toHaveValue('2026-09-05'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.change(date, { target: { value: '2026-09-02' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('You already logged a workout');
  });

  it('steps reps and weight with the −/+ buttons and accepts a decimal comma', async () => {
    signedInAs();
    const { squat } = seedCatalog();
    const { user } = renderApp('/workouts/new');

    await user.selectOptions(await exerciseSelect(1), squat.name);
    const reps = screen.getByLabelText('Reps');
    const weight = screen.getByLabelText('Weight (kg)');
    for (let i = 0; i < 3; i++)
      await user.click(screen.getByRole('button', { name: 'Reps: increase' }));
    expect(reps).toHaveValue('3');
    await user.click(screen.getByRole('button', { name: 'Weight (kg): increase' }));
    expect(weight).toHaveValue('2.5');
    // Typed with the decimal comma of a Spanish iOS keypad, then bumped by one step.
    await user.clear(weight);
    await user.type(weight, '62,5');
    await user.click(screen.getByRole('button', { name: 'Weight (kg): increase' }));
    expect(weight).toHaveValue('65');
    await user.click(screen.getByRole('button', { name: 'Weight (kg): decrease' }));
    expect(weight).toHaveValue('62.5');
    // Reps never go below 1.
    for (let i = 0; i < 5; i++)
      await user.click(screen.getByRole('button', { name: 'Reps: decrease' }));
    expect(reps).toHaveValue('1');

    await user.clear(weight);
    await user.type(weight, '97,5');
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    await screen.findByRole('heading', { name: squat.name });
    expect(apiState.workouts[0].exercises[0].sets).toEqual([
      expect.objectContaining({ reps: 1, weightKg: 97.5 }),
    ]);
  });

  it('hides the tab bar while the form is open', async () => {
    signedInAs();
    seedCatalog();
    const { user } = renderApp('/workouts');

    const tabs = await screen.findByRole('navigation', { name: 'Tabs' });
    await user.click(within(tabs).getByRole('link', { name: 'Log workout' }));

    expect(await screen.findByRole('heading', { name: 'Log workout' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Tabs' })).not.toBeInTheDocument();
  });

  it('can remove an extra set and an extra exercise before saving', async () => {
    signedInAs();
    const { squat } = seedCatalog();
    const { user } = renderApp('/workouts/new');

    await user.selectOptions(await exerciseSelect(1), squat.name);
    await user.type(screen.getByLabelText('Reps'), '5');
    await user.type(screen.getByLabelText('Weight (kg)'), '100');
    await user.click(screen.getByRole('button', { name: '+ Add set' }));
    await user.click(screen.getByRole('button', { name: 'Remove set 2' }));
    await user.click(screen.getByRole('button', { name: '+ Add exercise' }));
    await user.click(screen.getByRole('button', { name: 'Remove exercise 2' }));

    expect(screen.getAllByLabelText('Reps')).toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Exercise 2' })).not.toBeInTheDocument();
    // The only set can't be removed.
    expect(screen.getByRole('button', { name: 'Remove set 1' })).toBeDisabled();
  });

  it('shows the API error when the workout is rejected', async () => {
    signedInAs();
    const { squat } = seedCatalog();
    const { user } = renderApp('/workouts/new');

    await user.selectOptions(await exerciseSelect(1), squat.name);
    await user.type(screen.getByLabelText('Reps'), '5');
    await user.type(screen.getByLabelText('Weight (kg)'), '100');
    // The exercise disappears from the catalog after the form loaded.
    apiState.exercises.splice(0, apiState.exercises.length);
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Workout references unknown exercises');
    expect(alert).toHaveTextContent(squat.id);
    expect(apiState.workouts).toHaveLength(0);
  });

  it('points to the catalog when there are no exercises yet', async () => {
    signedInAs();
    renderApp('/workouts/new');

    expect(await screen.findByText('The exercise catalog is empty.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add an exercise first' })).toHaveAttribute(
      'href',
      '/exercises',
    );
  });
});

describe('workout detail', () => {
  it('lists every set with optional RPE and rest', async () => {
    const me = signedInAs();
    const { squat } = seedCatalog();
    const workout = seedWorkout(me.id, {
      exercises: [
        {
          exerciseId: squat.id,
          sets: [
            { reps: 5, weightKg: 100, rpe: 8, restSeconds: 180 },
            { reps: 3, weightKg: 110 },
          ],
        },
      ],
    });

    renderApp(`/workouts/${workout.id}`);

    const rows = (await screen.findAllByRole('row')).slice(1); // skip header
    expect(
      rows.map((r) =>
        within(r)
          .getAllByRole('cell')
          .map((c) => c.textContent),
      ),
    ).toEqual([
      ['1', '5', '100 kg', '8', '180s'],
      ['2', '3', '110 kg', '—', '—'],
      ['8', '830 kg (1,829.8 lb) volume'], // the Total row: reps and volume added up
    ]);
    expect(screen.getByRole('rowheader', { name: 'Total' })).toBeInTheDocument();
    // Shown even when the exercise has a single equipment.
    expect(screen.getByLabelText('Equipment: Machine')).toBeInTheDocument();
    expect(screen.getByText('Volume 830 kg (1,829.8 lb)')).toBeInTheDocument();
  });

  it('shows all-alike sets as one row that counts them', async () => {
    const me = signedInAs();
    const { squat } = seedCatalog();
    const workout = seedWorkout(me.id, {
      exercises: [
        {
          exerciseId: squat.id,
          sets: Array.from({ length: 4 }, () => ({ reps: 10, weightKg: 100 })),
        },
      ],
    });

    renderApp(`/workouts/${workout.id}`);

    expect(await screen.findByRole('columnheader', { name: 'Sets' })).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(
      rows.map((r) =>
        within(r)
          .getAllByRole('cell')
          .map((c) => c.textContent),
      ),
    ).toEqual([
      ['4', '10', '100 kg'],
      ['40', '4,000 kg (8,818.5 lb) volume'], // the Total row
    ]);
  });

  it('deletes the workout after confirmation and returns to the list', async () => {
    const me = signedInAs();
    const { squat } = seedCatalog();
    const workout = seedWorkout(me.id, {
      exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100 }] }],
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user, router } = renderApp(`/workouts/${workout.id}`);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await screen.findByText('No workouts logged yet.');
    expect(currentUrl(router)).toBe('/workouts');
    expect(apiState.workouts).toHaveLength(0);
  });

  it('keeps the workout when deletion is cancelled', async () => {
    const me = signedInAs();
    const { squat } = seedCatalog();
    const workout = seedWorkout(me.id, {
      exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100 }] }],
    });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = renderApp(`/workouts/${workout.id}`);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(apiState.workouts).toHaveLength(1);
  });

  it('shows a not-found page for a workout that does not exist', async () => {
    signedInAs();
    seedCatalog();
    renderApp('/workouts/does-not-exist');

    expect(await screen.findByRole('heading', { name: 'Not found' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Workout not found');
  });

  it('links to the edit form', async () => {
    const me = signedInAs();
    const { squat } = seedCatalog();
    const workout = seedWorkout(me.id, {
      exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100 }] }],
    });
    const { user, router } = renderApp(`/workouts/${workout.id}`);

    await user.click(await screen.findByRole('link', { name: 'Edit' }));

    expect(await screen.findByRole('heading', { name: 'Edit workout' })).toBeInTheDocument();
    expect(currentUrl(router)).toBe(`/workouts/${workout.id}/edit`);
  });

  it('renews an expired session transparently while loading the page', async () => {
    const me = signedInAs();
    const { squat } = seedCatalog();
    const workout = seedWorkout(me.id, {
      notes: 'Still here',
      exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100 }] }],
    });
    // Access tokens expire before the page loads; the refresh token is still valid.
    expireAccessTokens();

    renderApp(`/workouts/${workout.id}`);

    expect(await screen.findByText('Still here')).toBeInTheDocument();
    await waitFor(() => expect(apiState.refreshCalls).toBe(1));
  });
});

describe('editing a workout', () => {
  it('starts from the saved session and replaces it, keeping RPE and rest', async () => {
    const me = signedInAs();
    const { squat, bench } = seedCatalog();
    const workout = seedWorkout(me.id, {
      performedAt: '2026-10-18T09:00:00.000Z',
      notes: 'Leg day',
      exercises: [
        { exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100, rpe: 8, restSeconds: 180 }] },
      ],
    });
    const { user, router } = renderApp(`/workouts/${workout.id}/edit`);

    // Prefilled with the saved values.
    expect(await exerciseSelect(1)).toHaveValue(squat.id);
    expect(screen.getByLabelText('Reps')).toHaveValue('5');
    expect(screen.getByLabelText('Notes')).toHaveValue('Leg day');

    const weight = screen.getByLabelText('Weight (kg)');
    await user.clear(weight);
    await user.type(weight, '105');
    await user.clear(screen.getByLabelText('Notes'));
    await user.type(screen.getByLabelText('Notes'), 'Heavier');
    await user.click(screen.getByRole('button', { name: '+ Add exercise' }));
    await user.selectOptions(await exerciseSelect(2), bench.name);
    const exercise2 = screen.getByRole('group', { name: 'Exercise 2' });
    await user.type(within(exercise2).getByLabelText('Reps'), '8');
    await user.type(within(exercise2).getByLabelText('Weight (kg)'), '60');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Heavier')).toBeInTheDocument();
    expect(currentUrl(router)).toBe(`/workouts/${workout.id}`);
    const [saved] = apiState.workouts;
    expect(apiState.workouts).toHaveLength(1);
    expect(saved.id).toBe(workout.id);
    expect(saved.exercises.map((e) => [e.exerciseId, e.sets])).toEqual([
      [squat.id, [expect.objectContaining({ reps: 5, weightKg: 105, rpe: 8, restSeconds: 180 })]],
      [bench.id, [expect.objectContaining({ reps: 8, weightKg: 60 })]],
    ]);
  });

  it('moves a workout to another routine day, or out of the routine', async () => {
    const me = signedInAs();
    const { squat, bench } = seedCatalog();
    const routine = seedRoutine(me.id, {
      name: '3 Days',
      days: [
        { name: 'Chest', exerciseIds: [bench.id] },
        { name: 'Back', exerciseIds: [bench.id] },
        { name: 'Legs', exerciseIds: [squat.id] },
      ],
    });
    const workout = seedWorkout(me.id, {
      routineDayId: routine.days[0].id,
      exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100 }] }],
    });
    const { user } = renderApp(`/workouts/${workout.id}/edit`);

    const day = await screen.findByLabelText('Routine day');
    expect(day).toHaveValue(routine.days[0].id);
    await user.selectOptions(day, 'Day 3 · Legs');
    // Editing only relabels: the logged exercises stay as they are.
    expect(await exerciseSelect(1)).toHaveValue(squat.id);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByRole('link', { name: 'Edit' });
    expect(apiState.workouts[0].routineDay).toMatchObject({ name: 'Legs' });

    await user.click(screen.getByRole('link', { name: 'Edit' }));
    await user.selectOptions(await screen.findByLabelText('Routine day'), 'No routine day');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByRole('link', { name: 'Edit' });
    expect(apiState.workouts[0].routineDay).toBeUndefined();
  });

  it('keeps the saved time unless the day changes', async () => {
    const me = signedInAs();
    const { squat } = seedCatalog();
    const workout = seedWorkout(me.id, {
      performedAt: '2026-10-18T07:45:00.000Z',
      exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100 }] }],
    });
    const { user } = renderApp(`/workouts/${workout.id}/edit`);

    const date = await screen.findByLabelText('Date');
    expect(date).toHaveValue(new Date('2026-10-18T07:45:00.000Z').toLocaleDateString('sv'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('link', { name: 'Edit' });
    expect(apiState.workouts[0].performedAt).toBe('2026-10-18T07:45:00.000Z');

    await user.click(screen.getByRole('link', { name: 'Edit' }));
    fireEvent.change(await screen.findByLabelText('Date'), { target: { value: '2026-10-11' } });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('link', { name: 'Edit' });
    expect(apiState.workouts[0].performedAt).toBe(new Date('2026-10-11T12:00').toISOString());
  });

  it('explains which exercise, set and field is wrong before saving', async () => {
    const me = signedInAs();
    const { squat, bench } = seedCatalog();
    const workout = seedWorkout(me.id, {
      exercises: [
        { exerciseId: bench.id, sets: [{ reps: 8, weightKg: 60 }] },
        { exerciseId: squat.id, sets: [{ reps: 1, weightKg: 2.27 }] },
      ],
    });
    const { user } = renderApp(`/workouts/${workout.id}/edit`);

    const exercise2 = await screen.findByRole('group', { name: 'Exercise 2' });
    const reps = within(exercise2).getByLabelText('Reps');
    await user.clear(reps);
    await user.type(reps, '0');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Some sets need fixing before saving:');
    expect(alert).toHaveTextContent(
      'Exercise 2 · Barbell Back Squat, set 1: reps must be a whole number from 1 to 1000 (it says "0").',
    );
    expect(reps).toHaveAttribute('aria-invalid', 'true');
    expect(apiState.workouts[0].exercises[1].sets[0].reps).toBe(1); // nothing sent
  });

  it('rewords API validation errors with the exercise and set they point at', async () => {
    const me = signedInAs();
    const { squat } = seedCatalog();
    const workout = seedWorkout(me.id, {
      exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100 }] }],
    });
    server.use(
      http.put('/api/workouts/:id', () =>
        HttpResponse.json(
          {
            type: 'urn:fitness:error:http_400',
            title: 'BAD_REQUEST',
            status: 400,
            detail: 'Validation failed',
            errors: { _: ['exercises.0.sets.0.weightKg must not be greater than 9999.99'] },
          },
          { status: 400, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    const { user } = renderApp(`/workouts/${workout.id}/edit`);

    await user.click(await screen.findByRole('button', { name: 'Save changes' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The server rejected some values:');
    expect(alert).toHaveTextContent(
      'Exercise 1 · Barbell Back Squat, set 1: weight must not be greater than 9999.99',
    );
  });

  it('leaves the workout untouched when cancelled', async () => {
    const me = signedInAs();
    const { squat } = seedCatalog();
    const workout = seedWorkout(me.id, {
      notes: 'Original',
      exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100 }] }],
    });
    const { user, router } = renderApp(`/workouts/${workout.id}/edit`);

    await user.type(await screen.findByLabelText('Notes'), ' changed');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));

    expect(await screen.findByText('Original')).toBeInTheDocument();
    expect(currentUrl(router)).toBe(`/workouts/${workout.id}`);
    expect(apiState.workouts[0].notes).toBe('Original');
  });

  it('shows a not-found page when editing a workout that does not exist', async () => {
    signedInAs();
    seedCatalog();
    renderApp('/workouts/does-not-exist/edit');

    expect(await screen.findByRole('heading', { name: 'Not found' })).toBeInTheDocument();
  });
});

/** The "+ bar … = …" line under a barbell set ("bar" is its own element, for the hover). */
const barHint = () =>
  screen.getByText(
    (_, el) => el?.matches('p.hint') === true && /^\+ bar/.test(el.textContent ?? ''),
  );

describe('barbell exercises', () => {
  it('adds the bar to the plates typed, and shows both', async () => {
    signedInAs({ weightUnit: 'lb' });
    const thrust = seedExercise({ name: 'Hip Thrust', equipment: [Equipment.Barbell] });
    const { user } = renderApp('/workouts/new');

    await user.selectOptions(await exerciseSelect(1), thrust.name);
    await user.type(screen.getByLabelText('Reps'), '12');
    await user.type(screen.getByLabelText('Plates (lb)'), '20');
    expect(barHint()).toHaveTextContent('+ bar 27.6 lb = 47.6 lb');
    // Hovering "bar" shows its weight in both units.
    expect(screen.getByText('bar')).toHaveAttribute('data-tip', 'Bar: 27.6 lb (12.5 kg)');
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    await screen.findByRole('heading', { name: 'Hip Thrust' });
    // Stored as the total lifted (9.07 kg of plates + the 12.5 kg bar).
    expect(apiState.workouts[0].exercises[0]).toMatchObject({
      barKg: 12.5,
      sets: [expect.objectContaining({ reps: 12, weightKg: 21.57 })],
    });
    const row = screen.getAllByRole('row')[1];
    // The plates as typed, and below them the sum with the bar.
    expect(within(row).getAllByRole('cell')[2]).toHaveTextContent('20 lb20 lb + bar = 47.6 lb');

    // Editing shows the plates again.
    await user.click(screen.getByRole('link', { name: 'Edit' }));
    expect(await screen.findByLabelText('Plates (lb)')).toHaveValue('20');
  });

  it('shows the plates, without the bar, when hovering the progress chart', async () => {
    const me = signedInAs({ weightUnit: 'lb' });
    const thrust = seedExercise({ name: 'Hip Thrust', equipment: [Equipment.Barbell] });
    for (const performedAt of ['2026-10-01T12:00:00.000Z', '2026-10-08T12:00:00.000Z']) {
      seedWorkout(me.id, {
        performedAt,
        // 20 lb of plates (9.07 kg) + the 12.7 kg (28 lb) bar, four times.
        exercises: [
          {
            exerciseId: thrust.id,
            barKg: 12.7,
            sets: Array.from({ length: 4 }, () => ({ reps: 12, weightKg: 21.77 })),
          },
        ],
      });
    }
    const { user } = renderApp(`/exercises/${thrust.id}`);

    await user.hover(await screen.findByRole('button', { name: /^Thu 8 Oct 2026: / }));
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Plates only, without the bar');
    expect(tip).toHaveTextContent('4 × 12 — 20 lb');
  });

  it('uses the bar weight set in Account, keeping the bar of past workouts', async () => {
    const me = signedInAs();
    const thrust = seedExercise({ name: 'Hip Thrust', equipment: [Equipment.Barbell] });
    const old = seedWorkout(me.id, {
      exercises: [{ exerciseId: thrust.id, barKg: 12.5, sets: [{ reps: 10, weightKg: 32.5 }] }],
    });
    const { user, router } = renderApp('/account');

    const bar = await screen.findByLabelText('Barbell weight (kg)');
    expect(bar).toHaveValue('12.5');
    await user.clear(bar);
    await user.type(bar, '20');
    await user.click(screen.getByRole('button', { name: 'Save bar weight' }));
    expect(await screen.findByText(/Now 20 kg/)).toBeInTheDocument();
    expect(apiState.users[0].barWeightKg).toBe(20);

    // A new barbell exercise uses the new bar…
    await router.navigate({ to: '/workouts/new' });
    await user.selectOptions(await exerciseSelect(1), thrust.name);
    expect(barHint()).toHaveTextContent('+ bar 20 kg');
    // …while the old workout keeps its 12.5 kg bar: 32.5 kg total is 20 kg of plates.
    await router.navigate({ to: '/workouts/$workoutId/edit', params: { workoutId: old.id } });
    expect(await screen.findByLabelText('Plates (kg)')).toHaveValue('20');
    expect(barHint()).toHaveTextContent('+ bar 12.5 kg = 32.5 kg');
  });

  it('has no bar for other equipment', async () => {
    signedInAs();
    const { squat } = seedCatalog();
    const { user } = renderApp('/workouts/new');

    await user.selectOptions(await exerciseSelect(1), squat.name);
    expect(screen.getByLabelText('Weight (kg)')).toBeInTheDocument();
    expect(screen.queryByText(/\+ bar/)).not.toBeInTheDocument();
  });
});

describe('in pounds', () => {
  it('logs and shows weights in lb while storing kg', async () => {
    signedInAs({ weightUnit: 'lb' });
    const { squat } = seedCatalog();
    const { user } = renderApp('/workouts/new');

    await user.selectOptions(await exerciseSelect(1), squat.name);
    await user.type(screen.getByLabelText('Reps'), '5');
    const weight = screen.getByLabelText('Weight (lb)');
    await user.type(weight, '135');
    await user.click(screen.getByRole('button', { name: 'Weight (lb): increase' }));
    expect(weight).toHaveValue('140'); // 5 lb steps
    await user.click(screen.getByRole('button', { name: 'Save workout' }));

    await screen.findByRole('heading', { name: squat.name });
    expect(apiState.workouts[0].exercises[0].sets[0]).toMatchObject({ reps: 5, weightKg: 63.5 });
    expect(screen.getAllByText('140 lb').length).toBeGreaterThan(0); // the set
    expect(screen.getAllByText(/700 lb \(318 kg\)/).length).toBeGreaterThan(0); // the volume
  });

  it('edits in lb without drifting the stored kg', async () => {
    const me = signedInAs({ weightUnit: 'lb' });
    const { squat } = seedCatalog();
    const workout = seedWorkout(me.id, {
      notes: 'Before',
      exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 20.41 }] }],
    });
    const { user } = renderApp(`/workouts/${workout.id}/edit`);

    expect(await screen.findByLabelText('Weight (lb)')).toHaveValue('45');
    await user.clear(screen.getByLabelText('Notes'));
    await user.type(screen.getByLabelText('Notes'), 'After');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByText('After');
    expect(apiState.workouts[0].exercises[0].sets[0].weightKg).toBe(20.41);
  });
});
