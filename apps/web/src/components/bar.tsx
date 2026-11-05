import { formatWeight } from './units';

/**
 * The word "bar" (barbell) or "handle" ("2 handles" with two heavy dumbbells), showing the
 * weight of one in both units on hover (or on tap/focus, for phones and keyboards). A CSS
 * tooltip: the native `title` one shows late or not at all.
 */
export function BarWord({
  barKg,
  kind = 'bar',
  count = 1,
}: {
  barKg: number;
  kind?: 'bar' | 'handle';
  count?: number;
}) {
  const weight = `${formatWeight(barKg, 'lb')} (${formatWeight(barKg, 'kg')})`;
  const title = kind === 'bar' ? 'Bar' : 'Handle';
  const word = count > 1 ? `${count} ${kind}s` : kind;
  const tip = count > 1 ? `${title}s: ${count} × ${weight}` : `${title}: ${weight}`;
  return (
    <span
      className="bar-word"
      tabIndex={0}
      data-tip={tip}
      aria-label={`${word}, ${count > 1 ? `${count} × ` : ''}${weight}`}
    >
      {word}
    </span>
  );
}
