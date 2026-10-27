import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Muscle } from '@fitness/contracts';
import { MuscleMap } from './muscle-map';

/** The highlight classes used by a drawing zone's polygons (a zone has one or more). */
const zone = (container: HTMLElement, region: string) =>
  new Set(
    [...container.querySelectorAll(`[data-muscle="${region}"]`)].map((p) =>
      p.getAttribute('class'),
    ),
  );

describe('MuscleMap', () => {
  it('lights main muscles bright and secondary ones pale, front and back', () => {
    const { container } = render(
      <MuscleMap primary={[Muscle.Glutes]} secondary={[Muscle.Hamstrings, Muscle.Adductors]} />,
    );

    expect(
      screen.getByRole('img', { name: 'Works: Glutes (main), Hamstrings, Adductors' }),
    ).toBeInTheDocument();
    expect(zone(container, 'gluteal')).toEqual(new Set(['mm-primary']));
    expect(zone(container, 'hamstring')).toEqual(new Set(['mm-secondary']));
    expect(zone(container, 'chest')).toEqual(new Set(['mm-base']));
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });

  it('keeps a zone bright when one muscle works it mainly and another also', () => {
    const { container } = render(
      <MuscleMap primary={[Muscle.Lats]} secondary={[Muscle.UpperBack]} />,
    );
    expect(zone(container, 'upper-back')).toEqual(new Set(['mm-primary']));
  });

  it('draws one figure when small, the side with the main muscles', () => {
    const { container } = render(
      <MuscleMap primary={[Muscle.Hamstrings]} secondary={[]} size="small" />,
    );
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    // The back view: hamstrings are drawn, the chest (front only) is not.
    expect(zone(container, 'hamstring')).toEqual(new Set(['mm-primary']));
    expect(zone(container, 'chest').size).toBe(0);
  });
});
