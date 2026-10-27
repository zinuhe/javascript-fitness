import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { ErrorMessage, formatDay, formatShortDate, labelize, parseDecimal } from './ui';

describe('labelize', () => {
  it.each([
    ['full_body', 'Full body'],
    ['chest', 'Chest'],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(labelize(input)).toBe(expected);
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

describe('formatDay', () => {
  const now = new Date(2026, 9, 22, 20, 0); // Thu Oct 22, 2026, local time

  it('says Today and Yesterday for the last two calendar days, with the full date', () => {
    expect(formatDay(new Date(2026, 9, 22, 7, 30).toISOString(), now)).toMatch(
      /^Today · Thursday.*October.*22.*2026$/,
    );
    expect(formatDay(new Date(2026, 9, 21, 23, 59).toISOString(), now)).toMatch(
      /^Yesterday · Wednesday.*October.*21.*2026$/,
    );
  });

  it('spells out the weekday, month and year otherwise', () => {
    expect(formatDay(new Date(2026, 6, 16, 12, 0).toISOString(), now)).toMatch(
      /^Thursday.*July.*16.*2026$/,
    );
    expect(formatDay(new Date(2025, 11, 31, 9, 0).toISOString(), now)).toMatch(/2025/);
    expect(formatShortDate(new Date(2026, 9, 3).toISOString(), now)).not.toMatch(/2026/);
  });
});

describe('parseDecimal', () => {
  it.each([
    ['62,5', 62.5],
    ['62.5', 62.5],
    [' 100 ', 100],
  ])('%j → %d', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });
});
