import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Equipment, Muscle, MuscleGroup } from '@fitness/contracts';
import { apiState, seedExercise, seedRoutine } from '../test/api';
import { currentUrl, renderApp, signedInAs } from '../test/render';

/** Two training exercises, three warm-ups, and a two-day routine warming up differently. */
function seedGuide(userId: string) {
  const bench = seedExercise({ name: 'Barbell Bench Press' });
  const squat = seedExercise({ name: 'Barbell Back Squat', muscleGroup: MuscleGroup.Legs });
  const catCow = seedExercise({
    name: 'Cat-Cow',
    muscleGroup: MuscleGroup.Back,
    primaryMuscles: [Muscle.LowerBack, Muscle.Abs],
    equipment: [Equipment.Bodyweight],
    warmup: true,
    dose: '10 reps',
    description: 'On all fours, arch your back up, then let it sag.',
  });
  const circles = seedExercise({
    name: 'Hip circles',
    muscleGroup: MuscleGroup.Glutes,
    equipment: [Equipment.Bodyweight],
    warmup: true,
    dose: '10 per side',
  });
  const pullApart = seedExercise({
    name: 'Band pull-apart',
    muscleGroup: MuscleGroup.Back,
    equipment: [Equipment.Bands],
    warmup: true,
  });
  const routine = seedRoutine(userId, {
    name: 'Upper / Lower',
    days: [
      { name: 'Upper', exerciseIds: [bench.id], warmupExerciseIds: [catCow.id] },
      { name: 'Legs', exerciseIds: [squat.id], warmupExerciseIds: [circles.id, catCow.id] },
    ],
  });
  return { bench, squat, catCow, circles, pullApart, routine };
}

/** "Exercises" or "Warm-up" in the tabs above the catalog (the tab bar has "Exercises" too). */
const catalogTab = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Catalog' })).getByRole('link', { name });

/** The names in a list of warm-up rows, with their position when they have one. */
const rowTitles = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.list-row-title')?.textContent);

describe('warm-up guide', () => {
  it('lists each day’s warm-up in order, apart from the exercises', async () => {
    const me = signedInAs();
    seedGuide(me.id);
    const { user, router } = renderApp('/exercises');

    // The catalog leaves warm-ups out…
    const catalog = await screen.findByRole('list', { name: 'Exercise catalog' });
    expect(rowTitles(catalog)).toEqual(['Barbell Back Squat', 'Barbell Bench Press']);
    expect(catalogTab('Exercises')).toHaveAttribute('aria-current', 'page');

    // …which have their own page, one section per day of the active routine.
    await user.click(catalogTab('Warm-up'));
    expect(await screen.findByRole('heading', { name: 'Warm-up', level: 1 })).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/exercises/warmup');
    expect(catalogTab('Warm-up')).toHaveAttribute('aria-current', 'page');
    expect(catalogTab('Exercises')).not.toHaveAttribute('aria-current');
    expect(rowTitles(screen.getByRole('list', { name: 'Warm-up for Day 1 · Upper' }))).toEqual([
      '1. Cat-Cow',
    ]);
    const legs = screen.getByRole('list', { name: 'Warm-up for Day 2 · Legs' });
    expect(rowTitles(legs)).toEqual(['1. Hip circles', '2. Cat-Cow']);
    // How much, the muscles (or the group) and how to do it.
    const [first, second] = within(legs).getAllByRole('link');
    expect(first).toHaveTextContent('10 per side · Glutes');
    expect(second).toHaveTextContent('10 reps · Lower back, Abs');
    expect(second).toHaveTextContent('On all fours, arch your back up, then let it sag.');
    // Every warm-up, by name, even those no day uses.
    expect(rowTitles(screen.getByRole('list', { name: 'Warm-up exercises' }))).toEqual([
      'Band pull-apart',
      'Cat-Cow',
      'Hip circles',
    ]);
    // The day done next is marked.
    expect(screen.getByRole('heading', { name: 'Day 1 · Upper Next up' })).toBeInTheDocument();
  });

  it('opens a warm-up with how much, its pictures and no progress', async () => {
    const me = signedInAs();
    const { catCow } = seedGuide(me.id);
    const { user, router } = renderApp('/exercises/warmup');

    const upper = await screen.findByRole('list', { name: 'Warm-up for Day 1 · Upper' });
    await user.click(within(upper).getByRole('link', { name: /Cat-Cow/ }));

    expect(await screen.findByRole('heading', { name: 'Cat-Cow' })).toBeInTheDocument();
    expect(currentUrl(router)).toBe(`/exercises/${catCow.id}`);
    expect(screen.getByText('How much:').closest('p')).toHaveTextContent('How much: 10 reps');
    expect(screen.getByText(catCow.description!)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your progress' })).toBeNull();
    // Back to the guide, not the catalog.
    await user.click(screen.getByRole('link', { name: '← Warm-up' }));
    expect(await screen.findByRole('heading', { name: 'Warm-up', level: 1 })).toBeInTheDocument();
  });

  it('adds a warm-up exercise, bodyweight unless told otherwise', async () => {
    signedInAs();
    const { user } = renderApp('/exercises/warmup');

    expect(await screen.findByText(/No warm-up exercises yet/)).toBeInTheDocument();
    const form = screen.getByRole('heading', { name: 'Add warm-up exercise' }).closest('form')!;
    await user.type(within(form).getByLabelText('Name'), 'Leg swings');
    await user.selectOptions(within(form).getByLabelText('Muscle group'), 'Legs');
    await user.type(within(form).getByLabelText('How much'), '10 per side');
    await user.type(
      within(form).getByLabelText('Description'),
      'Hold on to something and swing one leg forward and back.',
    );
    expect(within(form).getByRole('checkbox', { name: 'Bodyweight' })).toBeChecked();
    await user.click(within(form).getByRole('button', { name: 'Add warm-up exercise' }));

    const all = await screen.findByRole('list', { name: 'Warm-up exercises' });
    expect(rowTitles(all)).toEqual(['Leg swings']);
    expect(apiState.exercises[0]).toMatchObject({
      name: 'Leg swings',
      warmup: true,
      dose: '10 per side',
      equipment: [Equipment.Bodyweight],
    });
    // Still out of the catalog.
    await user.click(catalogTab('Exercises'));
    expect(await screen.findByText('No exercises yet.')).toBeInTheDocument();
  });

  it('edits how much, but a warm-up stays a warm-up', async () => {
    const me = signedInAs();
    const { circles } = seedGuide(me.id);
    const { user } = renderApp(`/exercises/${circles.id}/edit`);

    const dose = await screen.findByLabelText('How much');
    expect(dose).toHaveValue('10 per side');
    await user.clear(dose);
    await user.type(dose, '30 s');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('How much:')).toBeInTheDocument();
    expect(screen.getByText('30 s')).toBeInTheDocument();
    expect(apiState.exercises.find((e) => e.id === circles.id)).toMatchObject({
      warmup: true,
      dose: '30 s',
    });
  });

  it('chooses each day’s warm-up in the routine, from warm-ups only', async () => {
    const me = signedInAs();
    const { routine, catCow, circles, pullApart, bench } = seedGuide(me.id);
    const { user } = renderApp(`/routines/${routine.id}/edit`);

    const day1 = await screen.findByRole('group', { name: 'Day 1' });
    const addExercise = within(day1).getByRole('combobox', { name: 'Add exercise to day 1' });
    const addWarmup = within(day1).getByRole('combobox', { name: 'Add warm-up to day 1' });
    const options = (select: HTMLElement) =>
      within(select)
        .getAllByRole('option')
        .slice(1)
        .map((o) => o.textContent);
    expect(options(addExercise)).toEqual(['Barbell Back Squat', 'Barbell Bench Press']);
    expect(options(addWarmup)).toEqual(['Band pull-apart', 'Cat-Cow', 'Hip circles']);

    await user.selectOptions(addWarmup, pullApart.name);
    await user.click(within(day1).getByRole('button', { name: `Move ${pullApart.name} up` }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { name: routine.name })).toBeInTheDocument();
    expect(apiState.routines[0].days.map((d) => [d.exerciseIds, d.warmupExerciseIds])).toEqual([
      [[bench.id], [pullApart.id, catCow.id]],
      [[routine.days[1].exerciseIds[0]], [circles.id, catCow.id]],
    ]);
    // The routine shows each day's warm-up under its exercises.
    const upper = screen.getByRole('heading', { name: 'Day 1 · Upper' }).closest('article')!;
    expect(within(upper).getByText(/^Warm-up:/)).toHaveTextContent(
      'Warm-up: Band pull-apart · Cat-Cow',
    );
  });

  it('is linked from Start workout, and never offered when logging', async () => {
    const me = signedInAs();
    const { routine } = seedGuide(me.id);
    const { user, router } = renderApp('/workouts/start');

    await user.click(
      await screen.findByRole('link', { name: 'Warm-up for Day 1 · Upper · 1 exercise' }),
    );
    expect(await screen.findByRole('heading', { name: 'Warm-up', level: 1 })).toBeInTheDocument();
    expect(currentUrl(router)).toBe(`/exercises/warmup?day=${routine.days[0].id}`);
    expect(document.getElementById(`warmup-${routine.days[0].id}`)).toBeInTheDocument();

    await router.navigate({ to: '/workouts/new' });
    const group = await screen.findByRole('group', { name: 'Exercise 1' });
    await waitFor(() =>
      expect(
        within(within(group).getByRole('combobox', { name: 'Exercise' }))
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual(['Choose an exercise…', 'Barbell Back Squat', 'Barbell Bench Press']),
    );
  });
});
