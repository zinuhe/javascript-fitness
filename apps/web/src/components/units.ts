import { useSuspenseQuery } from '@tanstack/react-query';
import type { WeightUnit } from '@fitness/contracts';
import { meQuery } from '../api/queries';

/**
 * Weights are stored and sent in kilograms; the user reads and types them in their unit.
 * Converting back rounds to the API's precision (2 decimals in kg), and pounds are shown
 * with one decimal, so a value typed in lb survives the kg round trip unchanged.
 */
export const LB_PER_KG = 2.20462262;

/** −/+ step per unit: 2.5 kg, or 5 lb (a 2.5 lb plate on each side). */
export const WEIGHT_STEP: Record<WeightUnit, number> = { kg: 2.5, lb: 5 };

export const kgTo = (kg: number, unit: WeightUnit) => (unit === 'lb' ? kg * LB_PER_KG : kg);

export const toKg = (value: number, unit: WeightUnit) =>
  Math.round((unit === 'lb' ? value / LB_PER_KG : value) * 100) / 100;

/** A stored kg value as the text of a weight input in `unit`. */
export const weightInputValue = (kg: number, unit: WeightUnit) =>
  String(unit === 'lb' ? Math.round(kg * LB_PER_KG * 10) / 10 : kg);

const formats: Record<WeightUnit, Intl.NumberFormat> = {
  kg: new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }),
  lb: new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }),
};

/** "100 kg" or "220.5 lb" for a stored kg value. */
export const formatWeight = (kg: number, unit: WeightUnit) =>
  `${formats[unit].format(kgTo(kg, unit))} ${unit}`;

/** The signed-in user's unit (the profile is loaded for every page of the app). */
export function useWeightUnit(): WeightUnit {
  const { data: user } = useSuspenseQuery(meQuery);
  return user.weightUnit ?? 'kg';
}
