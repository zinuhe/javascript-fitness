import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Equipment, Muscle, MuscleGroup } from '@fitness/contracts';
import { apiState, seedExercise, seedRoutine, seedWorkout } from '../test/api';
import { currentUrl, renderApp, signedInAs } from '../test/render';

describe('exercise catalog', () => {
  it('lists exercises alphabetically with readable labels', async () => {
    signedInAs();
    seedExercise({
      name: 'Pull-up',
      muscleGroup: MuscleGroup.Back,
      equipment: [Equipment.Bodyweight],
    });
    seedExercise({
      name: 'Burpee',
      muscleGroup: MuscleGroup.FullBody,
      equipment: [Equipment.Bodyweight],
    });

    renderApp('/exercises');

    const list = await screen.findByRole('list', { name: 'Exercise catalog' });
    const rows = within(list)
      .getAllByRole('link')
      .map((link) =>
        [...link.querySelectorAll('.list-row-title, .list-row-meta')].map((p) => p.textContent),
      );
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
      equipment: [Equipment.Bodyweight],
    });
    seedExercise({
      name: 'Leg Press',
      muscleGroup: MuscleGroup.Legs,
      equipment: [Equipment.Machine],
    });
    const { user } = renderApp('/exercises');
    const search = await screen.findByRole('searchbox', { name: 'Search exercises' });
    const names = () =>
      within(screen.getByRole('list', { name: 'Exercise catalog' }))
        .getAllByRole('link')
        .map((link) => link.querySelector('.list-row-title')?.textContent);

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
    expect(screen.getByRole('checkbox', { name: 'Plate' })).toBeInTheDocument();
    const kettlebell = screen.getByRole('checkbox', { name: 'Kettlebell' });
    // Until one is ticked the browser asks for at least one equipment.
    expect(kettlebell).toBeRequired();
    await user.click(kettlebell);
    expect(kettlebell).not.toBeRequired();
    await user.type(screen.getByLabelText('Description'), '  Hold the bell at chest height  ');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));

    expect(await screen.findByRole('link', { name: /^Goblet Squat/ })).toBeInTheDocument();
    expect(apiState.exercises[0]).toMatchObject({
      name: 'Goblet Squat',
      muscleGroup: MuscleGroup.Legs,
      equipment: [Equipment.Kettlebell],
      description: 'Hold the bell at chest height',
    });
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: 'Kettlebell' })).not.toBeChecked();
  });

  it('adds an exercise done with several pieces of equipment', async () => {
    signedInAs();
    const { user } = renderApp('/exercises');

    await user.type(await screen.findByLabelText('Name'), 'Bench Press');
    await user.selectOptions(screen.getByLabelText('Muscle group'), 'Chest');
    // Ticked out of order; saved in catalog order.
    await user.click(screen.getByRole('checkbox', { name: 'Dumbbell' }));
    await user.click(screen.getByRole('checkbox', { name: 'Barbell' }));
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));

    expect(await screen.findByText('Chest · Barbell · Dumbbell')).toBeInTheDocument();
    expect(apiState.exercises[0].equipment).toEqual([Equipment.Barbell, Equipment.Dumbbell]);
  });

  it('shows the conflict message for a duplicate name', async () => {
    signedInAs();
    seedExercise({
      name: 'Plank',
      muscleGroup: MuscleGroup.Core,
      equipment: [Equipment.Bodyweight],
    });
    const { user } = renderApp('/exercises');

    await user.type(await screen.findByLabelText('Name'), 'Plank');
    await user.selectOptions(screen.getByLabelText('Muscle group'), 'Core');
    await user.click(screen.getByRole('checkbox', { name: 'Bodyweight' }));
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An exercise with this name already exists',
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

    const { user } = renderApp(`/exercises/${squat.id}`);

    const rows = (await screen.findAllByRole('row')).slice(1);
    const cells = rows.map((r) =>
      within(r)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    );
    // Session number (oldest is 1), the day with weekday and year, and the volume in the
    // other unit too.
    expect(cells).toEqual([
      [
        '2',
        'Thu 8 Oct 2026',
        '1050 kg (2315 lb)',
        '110 kg',
        '128.33 kg', // 110 × (1 + 5/30)
      ],
      ['1', 'Thu 1 Oct 2026', '500 kg (1102 lb)', '100 kg', '116.67 kg'],
    ]);
    const stat = (label: string) => screen.getByText(label).closest('div');
    expect(stat('Best est. 1RM')).toHaveTextContent('128.33 kg');
    expect(stat('Heaviest set')).toHaveTextContent('110 kg');
    expect(stat('Sessions')).toHaveTextContent('2');
    expect(
      screen.getByRole('img', { name: 'Estimated 1RM from 116.67 kg to 128.33 kg' }),
    ).toBeInTheDocument();
    // Each session's date links to its workout.
    expect(screen.getByRole('link', { name: 'Thu 8 Oct 2026' })).toHaveAttribute(
      'href',
      `/workouts/${apiState.workouts[1].id}`,
    );

    // Hovering a session's point shows its day and every set.
    await user.hover(screen.getByRole('button', { name: /^Thu 8 Oct 2026: / }));
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Thu 8 Oct 2026');
    expect(
      within(tip)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['5 × 100 kg', '5 × 110 kg']);
    await user.unhover(screen.getByRole('button', { name: /^Thu 8 Oct 2026: / }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // A session whose sets were all the same shows as one line: sets × reps — weight.
    await user.hover(screen.getByRole('button', { name: 'Thu 1 Oct 2026: 1 × 5 — 100 kg' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Thu 1 Oct 20261 × 5 — 100 kg');
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
    expect(screen.getByRole('checkbox', { name: 'Machine' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Machine' }));
    await user.click(screen.getByRole('checkbox', { name: 'Dumbbell' }));
    await user.type(screen.getByLabelText('Description'), 'Curl tumbado');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByRole('heading', { name: 'Lying Dumbbell Biceps Curl' }),
    ).toBeInTheDocument();
    expect(currentUrl(router)).toBe(`/exercises/${curl.id}`);
    expect(screen.getByText('Curl tumbado')).toBeInTheDocument();
    expect(apiState.exercises[0]).toMatchObject({
      name: 'Lying Dumbbell Biceps Curl',
      equipment: [Equipment.Dumbbell],
      description: 'Curl tumbado',
    });
  });

  it('picks main and secondary muscles, drawn on the map', async () => {
    signedInAs();
    const thrust = seedExercise({ name: 'Hip Thrust', muscleGroup: MuscleGroup.Glutes });
    const { user } = renderApp(`/exercises/${thrust.id}/edit`);

    const main = await screen.findByRole('group', { name: 'Main muscles' });
    const also = screen.getByRole('group', { name: 'Also works' });
    await user.click(within(main).getByRole('checkbox', { name: 'Glutes' }));
    // A main muscle can't also be secondary.
    expect(within(also).getByRole('checkbox', { name: 'Glutes' })).toBeDisabled();
    await user.click(within(also).getByRole('checkbox', { name: 'Hamstrings' }));
    await user.click(within(also).getByRole('checkbox', { name: 'Adductors' }));
    expect(
      screen.getByRole('img', { name: 'Works: Glutes (main), Hamstrings, Adductors' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByRole('heading', { name: 'Hip Thrust' });
    expect(apiState.exercises[0]).toMatchObject({
      primaryMuscles: [Muscle.Glutes],
      secondaryMuscles: [Muscle.Hamstrings, Muscle.Adductors],
    });
    expect(
      screen.getByRole('img', { name: 'Works: Glutes (main), Hamstrings, Adductors' }),
    ).toBeInTheDocument();
  });

  it('shows the conflict when the new name already exists', async () => {
    signedInAs();
    seedExercise({ name: 'Bench' });
    const other = seedExercise({ name: 'Incline Bench' });
    const { user } = renderApp(`/exercises/${other.id}/edit`);

    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'bench');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(apiState.exercises[1].name).toBe('Incline Bench');
  });

  it('refuses to remove equipment that logged workouts used', async () => {
    const me = signedInAs();
    const press = seedExercise({
      name: 'Bench Press',
      equipment: [Equipment.Barbell, Equipment.Dumbbell],
    });
    seedWorkout(me.id, {
      exercises: [
        { exerciseId: press.id, equipment: Equipment.Dumbbell, sets: [{ reps: 8, weightKg: 30 }] },
      ],
    });
    const { user } = renderApp(`/exercises/${press.id}/edit`);

    await user.click(await screen.findByRole('checkbox', { name: 'Dumbbell' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Logged workouts use this exercise with dumbbell',
    );
    expect(apiState.exercises[0].equipment).toEqual([Equipment.Barbell, Equipment.Dumbbell]);
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

describe('progress with several pieces of equipment', () => {
  it('shows one equipment at a time, switching with the tabs', async () => {
    const me = signedInAs();
    const press = seedExercise({
      name: 'Bench Press',
      equipment: [Equipment.Barbell, Equipment.Dumbbell],
    });
    seedWorkout(me.id, {
      performedAt: '2026-10-01T09:00:00.000Z',
      exercises: [
        { exerciseId: press.id, equipment: Equipment.Barbell, sets: [{ reps: 1, weightKg: 80 }] },
      ],
    });
    seedWorkout(me.id, {
      performedAt: '2026-10-08T09:00:00.000Z',
      exercises: [
        { exerciseId: press.id, equipment: Equipment.Dumbbell, sets: [{ reps: 1, weightKg: 30 }] },
      ],
    });
    const { user } = renderApp(`/exercises/${press.id}`);

    const tabs = await screen.findByRole('radiogroup', { name: 'Progress with' });
    const stat = (label: string) => screen.getByText(label).closest('div');
    expect(within(tabs).getByRole('radio', { name: 'Barbell' })).toBeChecked();
    expect(stat('Heaviest set')).toHaveTextContent('80 kg');
    expect(stat('Sessions')).toHaveTextContent('1');

    await user.click(within(tabs).getByRole('radio', { name: 'Dumbbell' }));

    await waitFor(() => expect(stat('Heaviest set')).toHaveTextContent('30 kg'));
    expect(stat('Sessions')).toHaveTextContent('1');
  });

  it('has no tabs for an exercise with a single equipment', async () => {
    signedInAs();
    const squat = seedExercise({ name: 'Squat' });
    renderApp(`/exercises/${squat.id}`);

    expect(await screen.findByRole('heading', { name: 'Squat' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });
});
