import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  Exercise,
  ExerciseImageRef,
  ExerciseImageSize,
  ExerciseImageSlot,
} from '@fitness/contracts';
import { MuscleMap, MusclesWorked } from './muscle-map';

/**
 * Picture 1 is the one shown small (forms, lists); picture 2 is an extra one, such as a
 * variant. Many pictures already show the whole movement, so slots don't mean start/end.
 */
export const SLOT_LABELS: Record<ExerciseImageSlot, string> = { 1: 'Picture 1', 2: 'Picture 2' };

/** Versioned, so the browser can keep it for good and refetches only when it changes. */
export function exerciseImageUrl(
  exerciseId: string,
  image: ExerciseImageRef,
  size: ExerciseImageSize,
): string {
  return `/api/media/exercises/${exerciseId}/${image.slot}/${size}?v=${image.version}`;
}

/** Small picture for lists inside a link (no button of its own); null without images. */
export function ExerciseThumb({ exercise }: { exercise: Exercise }) {
  const [cover] = exercise.images;
  if (!cover) return null;
  return (
    <img
      className="exercise-thumb"
      src={exerciseImageUrl(exercise.id, cover, 'thumb')}
      alt=""
      loading="lazy"
      decoding="async"
    />
  );
}

/**
 * The exercise's first picture as a small button that opens the viewer; without pictures,
 * the small muscle figure as before. For the workout form and the workout detail.
 */
export function ExercisePreview({
  exercise,
  size = 'medium',
}: {
  exercise?: Exercise;
  size?: 'small' | 'medium';
}) {
  const [open, setOpen] = useState(false);
  if (!exercise) return null;
  const [cover] = exercise.images;
  if (!cover) {
    if (exercise.primaryMuscles.length + exercise.secondaryMuscles.length === 0) return null;
    return (
      <MuscleMap
        primary={exercise.primaryMuscles}
        secondary={exercise.secondaryMuscles}
        size="small"
        decorative
      />
    );
  }
  return (
    <>
      <button
        type="button"
        className={`thumb-button ${size}`}
        aria-label={`Show pictures of ${exercise.name}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <img src={exerciseImageUrl(exercise.id, cover, 'thumb')} alt="" decoding="async" />
      </button>
      {open && <ExerciseImageViewer exercise={exercise} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Both pictures side by side, each opening the viewer at itself (exercise page). */
export function ExerciseGallery({ exercise }: { exercise: Exercise }) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  if (exercise.images.length === 0) return null;
  return (
    <div className="gallery">
      {exercise.images.map((image, index) => (
        <button
          key={image.slot}
          type="button"
          className="gallery-item"
          aria-label={`Show ${SLOT_LABELS[image.slot].toLowerCase()} large`}
          aria-haspopup="dialog"
          onClick={() => setOpenAt(index)}
        >
          <img src={exerciseImageUrl(exercise.id, image, 'large')} alt="" decoding="async" />
          <span>{SLOT_LABELS[image.slot]}</span>
        </button>
      ))}
      {openAt !== null && (
        <ExerciseImageViewer exercise={exercise} startAt={openAt} onClose={() => setOpenAt(null)} />
      )}
    </div>
  );
}

/**
 * Full-screen viewer: the pictures large, swiped sideways (scroll snapping, so it feels
 * native on iPhone), then the muscles and the description. Escape or ✕ closes it and
 * returns the focus to whatever opened it.
 */
export function ExerciseImageViewer({
  exercise,
  startAt = 0,
  onClose,
}: {
  exercise: Exercise;
  startAt?: number;
  onClose: () => void;
}) {
  const titleId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(startAt);
  const { images } = exercise;

  // Opens on the picture that was tapped.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollLeft = startAt * track.clientWidth;
  }, [startAt]);

  // The parent passes a new onClose on each render; the setup below must run only once.
  const close = useEffectEvent(() => onClose());
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    // The page behind must not scroll while the viewer is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, []);

  const show = (i: number) => {
    const track = trackRef.current;
    if (track) track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
    setIndex(i);
  };

  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="viewer-head">
        <h2 id={titleId}>{exercise.name}</h2>
        <button
          ref={closeRef}
          type="button"
          className="viewer-close"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div
        ref={trackRef}
        className="viewer-track"
        onScroll={(event) => {
          const track = event.currentTarget;
          if (track.clientWidth > 0) setIndex(Math.round(track.scrollLeft / track.clientWidth));
        }}
      >
        {images.map((image, i) => (
          <figure key={image.slot} className="viewer-slide">
            <img
              src={exerciseImageUrl(exercise.id, image, 'large')}
              alt={`${exercise.name}, ${SLOT_LABELS[image.slot].toLowerCase()}`}
              decoding="async"
            />
            {images.length > 1 && (
              <figcaption>
                {i + 1} of {images.length}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <div className="viewer-dots">
            {images.map((image, i) => (
              <button
                key={image.slot}
                type="button"
                aria-label={`Show ${SLOT_LABELS[image.slot].toLowerCase()}`}
                aria-current={i === index}
                onClick={() => show(i)}
              />
            ))}
          </div>
          <p className="viewer-hint">
            {index === 0 ? 'Swipe to see the next picture' : 'Swipe back to the first picture'}
          </p>
        </>
      )}
      <div className="viewer-info">
        <MusclesWorked exercise={exercise} />
        {exercise.description && <p>{exercise.description}</p>}
      </div>
    </div>,
    document.body,
  );
}
