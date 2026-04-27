import {
  formatWeight,
  formatWeightForInput,
  getWeightUnitLabel,
  kgToPreferredUnit,
  parsePreferredWeightInput,
  preferredUnitToKg,
} from '../src/utils/units';

describe('units', () => {
  describe('getWeightUnitLabel', () => {
    it('returns kg or lb', () => {
      expect(getWeightUnitLabel('kg')).toBe('kg');
      expect(getWeightUnitLabel('lb')).toBe('lb');
    });
  });

  describe('kgToPreferredUnit', () => {
    it('passes kg through unchanged', () => {
      expect(kgToPreferredUnit(100, 'kg')).toBe(100);
    });

    it('converts kg to lb at 2.2046226218', () => {
      expect(kgToPreferredUnit(100, 'lb')).toBeCloseTo(220.46226218, 5);
    });
  });

  describe('preferredUnitToKg', () => {
    it('passes kg through unchanged', () => {
      expect(preferredUnitToKg(100, 'kg')).toBe(100);
    });

    it('converts lb to kg', () => {
      expect(preferredUnitToKg(220.46226218, 'lb')).toBeCloseTo(100, 5);
    });

    it('round-trips kg -> lb -> kg without drift', () => {
      const startKg = 82.5;
      const lb = kgToPreferredUnit(startKg, 'lb');
      const backToKg = preferredUnitToKg(lb, 'kg' /* no-op */);
      // The lb value is in lb units; converting back through preferredUnitToKg('lb') gives kg.
      const trueRoundtrip = preferredUnitToKg(lb, 'lb');
      expect(backToKg).toBe(lb); // 'kg' identity check
      expect(trueRoundtrip).toBeCloseTo(startKg, 8);
    });
  });

  describe('parsePreferredWeightInput', () => {
    it('returns null for empty string', () => {
      expect(parsePreferredWeightInput('', 'kg')).toBeNull();
    });

    it('returns null for non-numeric input', () => {
      expect(parsePreferredWeightInput('abc', 'kg')).toBeNull();
    });

    it('returns null for negative values', () => {
      expect(parsePreferredWeightInput('-5', 'kg')).toBeNull();
    });

    it('parses kg input to kg', () => {
      expect(parsePreferredWeightInput('82.5', 'kg')).toBe(82.5);
    });

    it('parses lb input and converts to kg', () => {
      const result = parsePreferredWeightInput('182', 'lb');
      expect(result).not.toBeNull();
      expect(result).toBeCloseTo(82.5536, 3);
    });

    it('trims whitespace', () => {
      expect(parsePreferredWeightInput('  100  ', 'kg')).toBe(100);
    });

    it('accepts zero', () => {
      expect(parsePreferredWeightInput('0', 'kg')).toBe(0);
    });
  });

  describe('formatWeightForInput', () => {
    it('returns integer string when value is whole', () => {
      expect(formatWeightForInput(100, 'kg')).toBe('100');
    });

    it('returns one-decimal string when value has fraction', () => {
      expect(formatWeightForInput(82.5, 'kg')).toBe('82.5');
    });

    it('formats lb conversion', () => {
      expect(formatWeightForInput(100, 'lb')).toBe('220.5');
    });
  });

  describe('formatWeight', () => {
    it('appends kg label by default', () => {
      expect(formatWeight(100, 'kg')).toBe('100kg');
    });

    it('appends lb label when units=lb', () => {
      expect(formatWeight(100, 'lb')).toBe('220.5lb');
    });

    it('respects precision parameter', () => {
      expect(formatWeight(100.456, 'kg', 2)).toBe('100.46kg');
      expect(formatWeight(100.456, 'kg', 0)).toBe('100kg');
    });
  });
});
