import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MuscleGroup, Muscle } from '@fitness/contracts';
import { apiState, seedExercise, seedExerciseImages, seedWorkout, uploads } from '../test/api';
import { renderApp, signedInAs } from '../test/render';
import { exerciseImageUrl } from './exercise-images';
import { prepareExerciseImage } from './image-resize';

// jsdom has no real <canvas>: the resizing is checked on a device, here it's a stand-in.
vi.mock('./image-resize', () => ({
  prepareExerciseImage: vi.fn(async () => ({
    thumb: new Blob(['thumb'], { type: 'image/jpeg' }),
    large: new Blob(['a larger picture'], { type: 'image/jpeg' }),
  })),
}));

const photo = () => new File(['raw photo bytes'], 'IMG_0001.jpg', { type: 'image/jpeg' });

function seedBench() {
  return seedExercise({
    name: 'Barbell Bench Press',
    muscleGroup: MuscleGroup.Chest,
    primaryMuscles: [Muscle.Chest],
    description: 'Lower the bar to the chest, press it back up.',
  });
}

describe('exerciseImageUrl', () => {
  it('points at the public media route, versioned so it can be cached for good', () => {
    expect(exerciseImageUrl('ex-1', { slot: 2, version: 'abc' }, 'thumb')).toBe(
      '/api/media/exercises/ex-1/2/thumb?v=abc',
    );
  });
});

describe('pictures in Edit exercise', () => {
  it('resizes and uploads a picked photo right away, then shows it', async () => {
    signedInAs();
    const bench = seedBench();
    const { user } = renderApp(`/exercises/${bench.id}/edit`);

    expect(await screen.findAllByText('No picture')).toHaveLength(2);
    await user.upload(screen.getByLabelText('Picture 1'), photo());

    expect(await screen.findByAltText('Picture 1')).toHaveAttribute(
      'src',
      expect.stringContaining(`/api/media/exercises/${bench.id}/1/thumb?v=`),
    );
    expect(prepareExerciseImage).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'IMG_0001.jpg' }),
    );
    expect(uploads).toEqual([{ exerciseId: bench.id, slot: 1, thumb: 5, large: 16 }]);
    expect(screen.getByText('Replace')).toBeInTheDocument();
    // The end slot is untouched.
    expect(screen.getByText('No picture')).toBeInTheDocument();
  });

  it('removes a picture after confirming', async () => {
    signedInAs();
    const bench = seedExerciseImages(seedBench(), [1, 2]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderApp(`/exercises/${bench.id}/edit`);

    await user.click(await screen.findByRole('button', { name: 'Remove picture 2' }));

    await waitFor(() => expect(apiState.exercises[0].images.map((i) => i.slot)).toEqual([1]));
    expect(await screen.findByText('No picture')).toBeInTheDocument();
    expect(screen.getByAltText('Picture 1')).toBeInTheDocument();
  });

  it('explains a photo that could not be read, without uploading anything', async () => {
    signedInAs();
    const bench = seedBench();
    vi.mocked(prepareExerciseImage).mockRejectedValueOnce(
      new Error('This picture could not be read. Try a JPEG or PNG.'),
    );
    const { user } = renderApp(`/exercises/${bench.id}/edit`);

    await user.upload(await screen.findByLabelText('Picture 2'), photo());

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be read');
    expect(uploads).toEqual([]);
  });
});

describe('the picture while logging (option A)', () => {
  it('shows a thumbnail that opens a full-screen viewer, and Escape closes it', async () => {
    const me = signedInAs();
    const bench = seedExerciseImages(seedBench(), [1, 2]);
    const workout = seedWorkout(me.id, {
      exercises: [{ exerciseId: bench.id, sets: [{ reps: 5, weightKg: 100 }] }],
    });
    const { user } = renderApp(`/workouts/${workout.id}/edit`);

    const group = await screen.findByRole('group', { name: 'Exercise 1' });
    const thumb = within(group).getByRole('button', {
      name: 'Show pictures of Barbell Bench Press',
    });
    await user.click(thumb);

    const viewer = screen.getByRole('dialog', { name: 'Barbell Bench Press' });
    expect(within(viewer).getByAltText('Barbell Bench Press, picture 1')).toHaveAttribute(
      'src',
      exerciseImageUrl(bench.id, bench.images[0], 'large'),
    );
    expect(within(viewer).getByAltText('Barbell Bench Press, picture 2')).toBeInTheDocument();
    expect(within(viewer).getByText('1 of 2')).toBeInTheDocument();
    expect(within(viewer).getByText('Swipe to see the next picture')).toBeInTheDocument();
    expect(within(viewer).getByText(bench.description!)).toBeInTheDocument();
    expect(within(viewer).getByRole('button', { name: 'Close' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(thumb).toHaveFocus();
  });

  it('keeps the muscle figure for exercises without pictures', async () => {
    const me = signedInAs();
    const bench = seedBench();
    const workout = seedWorkout(me.id, {
      exercises: [{ exerciseId: bench.id, sets: [{ reps: 5, weightKg: 100 }] }],
    });
    renderApp(`/workouts/${workout.id}/edit`);

    const group = await screen.findByRole('group', { name: 'Exercise 1' });
    expect(within(group).queryByRole('button', { name: /^Show pictures/ })).not.toBeInTheDocument();
    expect(group.querySelector('.muscle-map.small')).not.toBeNull();
  });

  it('also opens from the workout detail; ✕ closes it', async () => {
    const me = signedInAs();
    const bench = seedExerciseImages(seedBench(), [1]);
    const workout = seedWorkout(me.id, {
      exercises: [{ exerciseId: bench.id, sets: [{ reps: 5, weightKg: 100 }] }],
    });
    const { user } = renderApp(`/workouts/${workout.id}`);

    await user.click(
      await screen.findByRole('button', { name: 'Show pictures of Barbell Bench Press' }),
    );
    const viewer = screen.getByRole('dialog', { name: 'Barbell Bench Press' });
    // One picture: nothing to swipe to.
    expect(within(viewer).queryByText(/Swipe/)).not.toBeInTheDocument();

    await user.click(within(viewer).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('pictures in the catalog and on the exercise page', () => {
  it('lists picture 1 in place of the muscle figure', async () => {
    signedInAs();
    seedExerciseImages(seedBench(), [1]);
    seedExercise({ name: 'Pull-up', muscleGroup: MuscleGroup.Back, primaryMuscles: [Muscle.Lats] });
    renderApp('/exercises');

    const bench = await screen.findByRole('link', { name: /Barbell Bench Press/ });
    expect(bench.querySelector('img.exercise-thumb')).not.toBeNull();
    const pullUp = screen.getByRole('link', { name: /Pull-up/ });
    expect(pullUp.querySelector('img')).toBeNull();
  });

  it('shows both pictures; each opens the viewer at itself', async () => {
    signedInAs();
    const bench = seedExerciseImages(seedBench(), [1, 2]);
    const { user } = renderApp(`/exercises/${bench.id}`);

    await user.click(await screen.findByRole('button', { name: 'Show picture 2 large' }));

    const viewer = screen.getByRole('dialog', { name: 'Barbell Bench Press' });
    expect(within(viewer).getByText('Swipe back to the first picture')).toBeInTheDocument();
    expect(within(viewer).getByRole('button', { name: 'Show picture 2' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});
