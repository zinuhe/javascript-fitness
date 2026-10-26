import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Equipment, MuscleGroup } from '@fitness/contracts';
import { apiState, seedExercise, seedRoutine, seedWorkout } from '../test/api';
import { currentUrl, renderApp, signedInAs } from '../test/render';

describe('exercise catalog', () => {
  it('lists exercises alphabetically with readable labels', async () => {
    signedInAs();
    seedExercise({
      name: 'Pull-up',
      muscleGroup: MuscleGroup.Back,
      equipment: Equipment.Bodyweight,
    });
    seedExercise({
      name: 'Burpee',
      muscleGroup: MuscleGroup.FullBody,
      equipment: Equipment.Bodyweight,
    });

    renderApp('/exercises');

    const list = await screen.findByRole('list', { name: 'Exercise catalog' });
    const rows = within(list)
      .getAllByRole('link')
      .map((link) => [...link.children].map((part) => part.textContent));
    expect(rows).toEqual([
      ['Burpee', 'Full body · Bodyweight'],
      ['Pull-up', 'Back · Bodyweight'],
    ]);
  });

  it('filters the catalog by name, muscle group or equipment', async () => {
    signedInAs();
    seedExercise({
      name: 'Pull-up',
      muscleGroup: MuscleGroup.Back,
      equipment: Equipment.Bodyweight,
    });
    seedExercise({
      name: 'Leg Press',
      muscleGroup: MuscleGroup.Legs,
      equipment: Equipment.Machine,
    });
    const { user } = renderApp('/exercises');
    const search = await screen.findByRole('searchbox', { name: 'Search exercises' });
    const names = () =>
      within(screen.getByRole('list', { name: 'Exercise catalog' }))
        .getAllByRole('link')
        .map((link) => link.firstChild?.textContent);

    await user.type(search, 'PRESS');
    expect(names()).toEqual(['Leg Press']);

    await user.clear(search);
    await user.type(search, 'bodyweight');
    expect(names()).toEqual(['Pull-up']);

    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByText('No exercises match “zzz”.')).toBeInTheDocument();
  });

  it('adds an exercise, refreshes the list and resets the form', async () => {
    signedInAs();
    const { user } = renderApp('/exercises');

    await user.type(await screen.findByLabelText('Name'), 'Goblet Squat');
    await user.selectOptions(screen.getByLabelText('Muscle group'), 'Legs');
    await user.selectOptions(screen.getByLabelText('Equipment'), 'Kettlebell');
    await user.type(screen.getByLabelText('Description'), '  Hold the bell at chest height  ');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));

    expect(await screen.findByRole('link', { name: /^Goblet Squat/ })).toBeInTheDocument();
    expect(apiState.exercises[0]).toMatchObject({
      name: 'Goblet Squat',
      muscleGroup: MuscleGroup.Legs,
      equipment: Equipment.Kettlebell,
      description: 'Hold the bell at chest height',
    });
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('shows the conflict message for a duplicate name + equipment', async () => {
    signedInAs();
    seedExercise({ name: 'Plank', muscleGroup: MuscleGroup.Core, equipment: Equipment.Bodyweight });
    const { user } = renderApp('/exercises');

    await user.type(await screen.findByLabelText('Name'), 'Plank');
    await user.selectOptions(screen.getByLabelText('Muscle group'), 'Core');
    await user.selectOptions(screen.getByLabelText('Equipment'), 'Bodyweight');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An exercise with this name and equipment already exists',
    );
    expect(apiState.exercises).toHaveLength(1);
    // The form keeps what was typed so it can be corrected.
    expect(screen.getByLabelText('Name')).toHaveValue('Plank');
  });
});

describe('exercise progress', () => {
  it('shows an empty state before any set is logged', async () => {
    signedInAs();
    const squat = seedExercise({ name: 'Barbell Back Squat', muscleGroup: MuscleGroup.Legs });

    renderApp(`/exercises/${squat.id}`);

    expect(await screen.findByRole('heading', { name: 'Barbell Back Squat' })).toBeInTheDocument();
    expect(screen.getByText(/No sets logged for this exercise yet/)).toBeInTheDocument();
    expect(screen.getByText('Legs')).toBeInTheDocument();
  });

  it('lists sessions newest first with volume, heaviest set and estimated 1RM', async () => {
    const me = signedInAs();
    const squat = seedExercise({ name: 'Barbell Back Squat', muscleGroup: MuscleGroup.Legs });
    seedWorkout(me.id, {
      performedAt: '2026-10-01T09:00:00.000Z',
      exercises: [{ exerciseId: squat.id, sets: [{ reps: 5, weightKg: 100 }] }],
    });
    seedWorkout(me.id, {
      performedAt: '2026-10-08T09:00:00.000Z',
      exercises: [
        {
          exerciseId: squat.id,
          sets: [
            { reps: 5, weightKg: 100 },
            { reps: 5, weightKg: 110 },
          ],
        },
      ],
    });

    renderApp(`/exercises/${squat.id}`);

    const rows = (await screen.findAllByRole('row')).slice(1);
    const cells = rows.map((r) =>
      within(r)
        .getAllByRole('cell')
        .slice(1)
        .map((c) => c.textContent),
    );
    expect(cells).toEqual([
      ['1,050 kg', '110 kg', '128.33 kg'], // 110 × (1 + 5/30)
      ['500 kg', '100 kg', '116.67 kg'],
    ]);
    const stat = (label: string) => screen.getByText(label).closest('div');
    expect(stat('Best est. 1RM')).toHaveTextContent('128.33 kg');
    expect(stat('Heaviest set')).toHaveTextContent('110 kg');
    expect(stat('Sessions')).toHaveTextContent('2');
    expect(
      screen.getByRole('img', { name: 'Estimated 1RM from 116.67 kg to 128.33 kg' }),
    ).toBeInTheDocument();
  });
});

describe('editing and deleting exercises', () => {
  it('edits an exercise from its page', async () => {
    signedInAs();
    const curl = seedExercise({ name: 'Curl', muscleGroup: MuscleGroup.Biceps });
    const { user, router } = renderApp(`/exercises/${curl.id}`);

    await user.click(await screen.findByRole('link', { name: 'Edit' }));
    const name = await screen.findByLabelText('Name');
    expect(name).toHaveValue('Curl');
    expect(screen.getByLabelText('Muscle group')).toHaveValue('biceps');
    await user.clear(name);
    await user.type(name, 'Lying Dumbbell Biceps Curl');
    await user.selectOptions(screen.getByLabelText('Equipment'), 'Dumbbell');
    await user.type(screen.getByLabelText('Description'), 'Curl tumbado');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByRole('heading', { name: 'Lying Dumbbell Biceps Curl' }),
    ).toBeInTheDocument();
    expect(currentUrl(router)).toBe(`/exercises/${curl.id}`);
    expect(screen.getByText('Curl tumbado')).toBeInTheDocument();
    expect(apiState.exercises[0]).toMatchObject({
      name: 'Lying Dumbbell Biceps Curl',
      equipment: Equipment.Dumbbell,
      description: 'Curl tumbado',
    });
  });

  it('shows the conflict when the new name + equipment already exists', async () => {
    signedInAs();
    seedExercise({ name: 'Bench', equipment: Equipment.Barbell });
    const other = seedExercise({ name: 'Bench', equipment: Equipment.Dumbbell });
    const { user } = renderApp(`/exercises/${other.id}/edit`);

    await user.selectOptions(await screen.findByLabelText('Equipment'), 'Barbell');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(apiState.exercises[1].equipment).toBe(Equipment.Dumbbell);
  });

  it('deletes an unused exercise after confirmation', async () => {
    signedInAs();
    const unused = seedExercise({ name: 'Old Exercise' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user, router } = renderApp(`/exercises/${unused.id}`);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await screen.findByRole('heading', { name: 'Exercises' });
    expect(currentUrl(router)).toBe('/exercises');
    expect(apiState.exercises).toHaveLength(0);
  });

  it('explains why an exercise used by a routine cannot be deleted', async () => {
    const me = signedInAs();
    const squat = seedExercise({ name: 'Squat' });
    seedRoutine(me.id, { name: 'Legs', days: [{ exerciseIds: [squat.id] }] });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderApp(`/exercises/${squat.id}`);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'used by logged workouts or routines',
    );
    expect(apiState.exercises).toHaveLength(1);
  });

  it('keeps the edit unsaved when cancelled', async () => {
    signedInAs();
    const curl = seedExercise({ name: 'Curl' });
    const { user, router } = renderApp(`/exercises/${curl.id}/edit`);

    await user.type(await screen.findByLabelText('Name'), ' changed');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));

    expect(await screen.findByRole('heading', { name: 'Curl' })).toBeInTheDocument();
    expect(currentUrl(router)).toBe(`/exercises/${curl.id}`);
  });
});
