import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Equipment, MuscleGroup } from '@fitness/contracts';
import { apiState, seedExercise, seedWorkout } from '../test/api';
import { renderApp, signedInAs } from '../test/render';

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

    const rows = (await screen.findAllByRole('row')).slice(1);
    expect(
      rows.map((r) =>
        within(r)
          .getAllByRole('cell')
          .map((c) => c.textContent),
      ),
    ).toEqual([
      ['Burpee', 'Full body', 'Bodyweight'],
      ['Pull-up', 'Back', 'Bodyweight'],
    ]);
  });

  it('adds an exercise, refreshes the table and resets the form', async () => {
    signedInAs();
    const { user } = renderApp('/exercises');

    await user.type(await screen.findByLabelText('Name'), 'Goblet Squat');
    await user.selectOptions(screen.getByLabelText('Muscle group'), 'Legs');
    await user.selectOptions(screen.getByLabelText('Equipment'), 'Kettlebell');
    await user.type(screen.getByLabelText('Description'), '  Hold the bell at chest height  ');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));

    expect(await screen.findByRole('link', { name: 'Goblet Squat' })).toBeInTheDocument();
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
    expect(screen.getByText('Best est. 1RM: 128.33 kg')).toBeInTheDocument();
  });
});
