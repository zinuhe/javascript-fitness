import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Equipment, MuscleGroup } from '@fitness/contracts';
import { apiState, expireAccessTokens, seedExercise, seedWorkout } from '../test/api';
import { currentUrl, renderApp, signedInAs } from '../test/render';

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
      equipment: Equipment.Barbell,
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
    expect(card).toHaveTextContent('Barbell Back Squat · Barbell Bench Press');
    expect(card).toHaveTextContent('3 sets · 1,530 kg'); // 500 + 550 + 480
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
    for (let day = 1; day <= 12; day++) {
      seedWorkout(me.id, {
        performedAt: `2026-10-${String(day).padStart(2, '0')}T09:00:00.000Z`,
        notes: `Session ${day}`,
        exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100 }] }],
      });
    }
    const { user, router } = renderApp('/workouts');

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Session 12')).toBeInTheDocument(); // newest first

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
    expect(weights[1]).toHaveValue(100);
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
    expect(screen.getByText('1,050 kg')).toBeInTheDocument();
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
