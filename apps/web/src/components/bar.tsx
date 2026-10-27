import { formatWeight } from './units';

/**
 * The word "bar", showing the bar's weight in both units on hover (or on tap/focus, for
 * phones and keyboards). A CSS tooltip: the native `title` one shows late or not at all.
 */
export function BarWord({ barKg }: { barKg: number }) {
  const weight = `${formatWeight(barKg, 'lb')} (${formatWeight(barKg, 'kg')})`;
  return (
    <span
      className="bar-word"
      tabIndex={0}
      data-tip={`Bar: ${weight}`}
      aria-label={`bar, ${weight}`}
    >
      bar
    </span>
  );
}
