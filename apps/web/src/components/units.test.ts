import { describe, expect, it } from 'vitest';
import {
  formatTableVolume,
  formatVolume,
  formatWeight,
  kgTo,
  toKg,
  weightInputValue,
} from './units';

describe('weight units', () => {
  it('leaves kilograms untouched', () => {
    expect(toKg(62.5, 'kg')).toBe(62.5);
    expect(weightInputValue(62.5, 'kg')).toBe('62.5');
    expect(formatWeight(1050, 'kg')).toBe('1,050 kg');
  });

  it('converts pounds to kilograms at the API precision', () => {
    expect(toKg(45, 'lb')).toBe(20.41);
    expect(toKg(22.5, 'lb')).toBe(10.21);
    expect(kgTo(100, 'lb')).toBeCloseTo(220.46, 2);
    expect(formatWeight(100, 'lb')).toBe('220.5 lb');
  });

  it('sums reps × weight as volume, kilograms as whole numbers', () => {
    const sets = [
      { reps: 5, weightKg: 100 },
      { reps: 3, weightKg: 110.5 },
    ];
    // In the user's unit, with the other one in parentheses.
    expect(formatVolume(sets, 'kg')).toBe('832 kg (1,833.1 lb)');
    expect(formatVolume([], 'kg')).toBe('0 kg (0 lb)');
  });

  it('adds pound volumes from the weights as shown, without kg rounding drift', () => {
    // 10 lb is stored as 4.54 kg (10.009 lb): 4 × 25 reps must still read 1,000 lb.
    const set = { reps: 25, weightKg: toKg(10, 'lb') };
    expect(formatVolume([set, set, set, set], 'lb')).toBe('1,000 lb (454 kg)');
  });

  it('formats table volumes without thousands separators, the other unit whole', () => {
    expect(formatTableVolume(1273.7, 'lb')).toEqual({ main: '2808 lb', other: '1274 kg' });
    expect(formatTableVolume(1050, 'kg')).toEqual({ main: '1050 kg', other: '2315 lb' });
  });

  it('keeps every typed pound value through the kg round trip', () => {
    // Typed in lb → stored in kg (2 decimals) → shown again in lb.
    for (let tenths = 0; tenths <= 10_000; tenths += 5) {
      const typed = tenths / 10; // 0, 0.5, 1 … 1000 lb
      expect(weightInputValue(toKg(typed, 'lb'), 'lb')).toBe(String(typed));
    }
  });
});
