import { formatWeight } from './units';

/**
 * The word "bar" (barbell) or "handle" (heavy dumbbell), showing its weight in both units
 * on hover (or on tap/focus, for phones and keyboards). A CSS tooltip: the native `title`
 * one shows late or not at all.
 */
export function BarWord({ barKg, kind = 'bar' }: { barKg: number; kind?: 'bar' | 'handle' }) {
  const weight = `${formatWeight(barKg, 'lb')} (${formatWeight(barKg, 'kg')})`;
  const title = kind === 'bar' ? 'Bar' : 'Handle';
  return (
    <span
      className="bar-word"
      tabIndex={0}
      data-tip={`${title}: ${weight}`}
      aria-label={`${kind}, ${weight}`}
    >
      {kind}
    </span>
  );
}
