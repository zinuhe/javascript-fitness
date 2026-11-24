import type { ReactNode } from 'react';
import type { Equipment, WeightUnit } from '@fitness/contracts';
import { BarIcon, DumbbellIcon, PlateIcon } from './icons';
import { fixedPartCount, fixedPartKg, fixedPartOf } from './ui';
import { formatWeight, formatWholeInOtherUnit } from './units';

/** "12 lb (5.44 kg)": a bar, handle or plates in both units, for a tooltip. */
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

/** An icon before a weight, saying what it is ("Handle", "Plates") on hover, tap or focus. */
function WeightIcon({ name, kg, children }: { name: string; kg: number; children: ReactNode }) {
  const weight = bothUnits(kg);
  return (
    <span
      className="bar-word bar-icon"
      role="img"
      tabIndex={0}
      data-tip={`${name}: ${weight}`}
      aria-label={`${name}, ${weight}`}
    >
      {children}
    </span>
  );
}

/**
 * "◎" before the weight of the plates a bar or heavy dumbbells were loaded with, saying so
 * (and that weight in both units) on hover or tap.
 */
export function PlatesMark({ platesKg }: { platesKg: number }) {
  return (
    <WeightIcon name="Plates" kg={platesKg}>
      <PlateIcon size="1.15em" />
    </WeightIcon>
  );
}

/**
 * A set's total split into its plates and its bar (or handles), one small line each with the
 * other unit beside it: "◎ 80 lb (36 kg)" over "⊢⊣ 8 lb (4 kg)", or "🏋 2 × 12 lb (5 kg)"
 * for two heavy dumbbells. Each icon names its
 * part, with the weight in both units, on hover or tap. Nothing for a set without a bar or
 * handle.
 */
export function SetParts({
  weightKg,
  barKg,
  equipment,
  dumbbells,
  unit,
}: {
  /** The total lifted, bar or handles included. */
  weightKg: number;
  /** One bar, or one handle. */
  barKg?: number;
  equipment?: Equipment;
  dumbbells?: number;
  unit: WeightUnit;
}) {
  const fixedKg = fixedPartKg(barKg, equipment, dumbbells);
  if (barKg === undefined || fixedKg === 0) return null;
  const count = fixedPartCount(equipment, dumbbells);
  const handles = fixedPartOf(equipment) === 'handle';
  return (
    <span className="set-parts">
      <span className="set-part">
        <span className="nowrap">
          <PlatesMark platesKg={weightKg - fixedKg} />
          {formatWeight(weightKg - fixedKg, unit)}
        </span>{' '}
        <span className="nowrap">({formatWholeInOtherUnit(weightKg - fixedKg, unit)})</span>
      </span>
      <span className="set-part">
        <span className="nowrap">
          {handles ? (
            <WeightIcon name="Handle" kg={barKg}>
              <DumbbellIcon size="1.15em" />
            </WeightIcon>
          ) : (
            <WeightIcon name="Bar" kg={barKg}>
              <BarIcon size="1.15em" />
            </WeightIcon>
          )}
          {count > 1 ? `${count} × ` : ''}
          {formatWeight(barKg, unit)}
        </span>{' '}
        {/* Of one bar or handle, like the weight before it. */}
        <span className="nowrap">({formatWholeInOtherUnit(barKg, unit)})</span>
      </span>
    </span>
  );
}

/** "🏋 12 lb": the handle of one heavy dumbbell. */
function Handle({ handleKg, unit }: { handleKg: number; unit: WeightUnit }) {
  return (
    <>
      <WeightIcon name="Handle" kg={handleKg}>
        <DumbbellIcon size="1.15em" />
      </WeightIcon>
      {formatWeight(handleKg, unit)}
    </>
  );
}

/** The handles of heavy dumbbells while no plates are typed yet: "2 × 🏋 12 lb". */
export function Handles({
  handleKg,
  count,
  unit,
}: {
  handleKg: number;
  count: number;
  unit: WeightUnit;
}) {
  return (
    <>
      {count > 1 ? `${count} × ` : ''}
      <Handle handleKg={handleKg} unit={unit} />
    </>
  );
}

/**
 * What each heavy dumbbell weighs, one row per dumbbell (its handle plus its share of the
 * plates), and what they add up to:
 *
 *     🏋 12 lb + ◎ 10 lb = 22 lb
 *     🏋 12 lb + ◎ 10 lb = 22 lb
 *     Total 44 lb (20 kg)
 *
 * With one dumbbell its row is the total: "🏋 12 lb + ◎ 20 lb = 32 lb (15 kg)".
 */
export function DumbbellSum({
  handleKg,
  platesKg,
  totalKg,
  count,
  unit,
  otherUnit = false,
}: {
  handleKg: number;
  /** The plates of all the dumbbells together. */
  platesKg: number;
  /** Everything lifted: the plates plus one handle per dumbbell. */
  totalKg: number;
  count: number;
  unit: WeightUnit;
  /** Also say the total in the unit the user does not use: "(20 kg)". */
  otherUnit?: boolean;
}) {
  const total = `${formatWeight(totalKg, unit)}${
    otherUnit ? ` (${formatWholeInOtherUnit(totalKg, unit)})` : ''
  }`;
  const each = (
    <>
      <Handle handleKg={handleKg} unit={unit} /> +{' '}
      <WeightIcon name="Plates" kg={platesKg / count}>
        <PlateIcon size="1.15em" />
      </WeightIcon>
      {formatWeight(platesKg / count, unit)} ={' '}
    </>
  );
  if (count <= 1) {
    return (
      <span className="dumbbell-row">
        {each}
        {total}
      </span>
    );
  }
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <span className="dumbbell-row" key={index}>
          {each}
          {formatWeight(totalKg / count, unit)}
        </span>
      ))}
      <span className="dumbbell-total">Total {total}</span>
    </>
  );
}
