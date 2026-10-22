import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { ErrorMessage, labelize, setsVolume } from './ui';

describe('labelize', () => {
  it.each([
    ['full_body', 'Full body'],
    ['chest', 'Chest'],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(labelize(input)).toBe(expected);
  });
});

describe('setsVolume', () => {
  it('sums reps × weight across sets', () => {
    const sets = [
      { id: 'a', order: 0, reps: 5, weightKg: 100 },
      { id: 'b', order: 1, reps: 3, weightKg: 110.5 },
    ];
    expect(setsVolume(sets)).toBe(831.5);
    expect(setsVolume([])).toBe(0);
  });
});

describe('ErrorMessage', () => {
  it('renders nothing without an error', () => {
    const { container } = render(<ErrorMessage error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the API detail and every field error', () => {
    const error = new ApiError({
      type: 'urn:fitness:error:validation',
      title: 'validation',
      status: 422,
      detail: 'Workout references unknown exercises',
      errors: { exerciseId: ['ex-1', 'ex-2'] },
    });

    render(<ErrorMessage error={error} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Workout references unknown exercises');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['ex-1', 'ex-2']);
  });

  it('explains network failures in plain language', () => {
    render(<ErrorMessage error={new TypeError('Failed to fetch')} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/could not reach the server/i);
  });
});
