import { describe, expect, it } from 'vitest';
import { formatWeight, kgTo, toKg, weightInputValue } from './units';

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

  it('keeps every typed pound value through the kg round trip', () => {
    // Typed in lb → stored in kg (2 decimals) → shown again in lb.
    for (let tenths = 0; tenths <= 10_000; tenths += 5) {
      const typed = tenths / 10; // 0, 0.5, 1 … 1000 lb
      expect(weightInputValue(toKg(typed, 'lb'), 'lb')).toBe(String(typed));
    }
  });
});
