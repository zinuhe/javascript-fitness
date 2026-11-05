import type { WeightUnit } from '@fitness/contracts';
import { DumbbellIcon } from './icons';
import { formatWeight } from './units';

/** "12 lb (5.44 kg)": a bar or handle in both units, for its tooltip. */
const bothUnits = (kg: number) => `${formatWeight(kg, 'lb')} (${formatWeight(kg, 'kg')})`;

/**
 * The word "bar", showing the bar's weight in both units on hover (or on tap/focus, for
 * phones and keyboards). A CSS tooltip: the native `title` one shows late or not at all.
 */
export function BarWord({ barKg }: { barKg: number }) {
  const weight = bothUnits(barKg);
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

/**
 * Each heavy dumbbell, the part before the "=": "2 × (🏋 12 lb + 10 lb)", its handle (an icon
 * with the weight in both units on hover or tap) plus its share of the plates. With one
 * dumbbell, "🏋 12 lb + 20 lb"; while no plates are typed, just the handles: "2 × 🏋 12 lb".
 */
export function PerDumbbell({
  handleKg,
  platesKg,
  count,
  unit,
}: {
  handleKg: number;
  /** The plates of all the dumbbells together. */
  platesKg?: number;
  count: number;
  unit: WeightUnit;
}) {
  const weight = bothUnits(handleKg);
  const handle = (
    <>
      <span
        className="bar-word bar-icon"
        role="img"
        tabIndex={0}
        data-tip={`Handle: ${weight}`}
        aria-label={`Handle, ${weight}`}
      >
        <DumbbellIcon size="1.15em" />
      </span>
      {formatWeight(handleKg, unit)}
    </>
  );
  const times = count > 1 ? `${count} × ` : '';
  if (platesKg === undefined) {
    return (
      <>
        {times}
        {handle}
      </>
    );
  }
  const plates = formatWeight(platesKg / count, unit);
  return count > 1 ? (
    <>
      {times}({handle} + {plates})
    </>
  ) : (
    <>
      {handle} + {plates}
    </>
  );
}
