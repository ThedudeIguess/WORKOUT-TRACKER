import type { UnitPreference } from '../types';

const KG_TO_LB = 2.2046226218;

export function getWeightUnitLabel(units: UnitPreference): string {
  return units === 'lb' ? 'lb' : 'kg';
}

export function kgToPreferredUnit(
  weightKg: number,
  units: UnitPreference
): number {
  return units === 'lb' ? weightKg * KG_TO_LB : weightKg;
}

export function preferredUnitToKg(
  weight: number,
  units: UnitPreference
): number {
  return units === 'lb' ? weight / KG_TO_LB : weight;
}

export function parsePreferredWeightInput(
  value: string,
  units: UnitPreference
): number | null {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return preferredUnitToKg(parsed, units);
}

export function formatWeightForInput(
  weightKg: number,
  units: UnitPreference
): string {
  const displayWeight = kgToPreferredUnit(weightKg, units);
  if (!Number.isFinite(displayWeight)) {
    return '';
  }

  return Number.isInteger(displayWeight)
    ? String(displayWeight)
    : displayWeight.toFixed(1);
}

export function formatWeight(
  weightKg: number,
  units: UnitPreference,
  precision = 1
): string {
  const displayWeight = kgToPreferredUnit(weightKg, units);
  const rounded = Number(displayWeight.toFixed(precision));
  return `${rounded}${getWeightUnitLabel(units)}`;
}
