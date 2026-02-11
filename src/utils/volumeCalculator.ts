import {
  excludedFromDefaultHypertrophyVolume,
  metconDiscounts,
} from '../constants/exercises';
import { muscleGroups } from '../constants/mevThresholds';
import { getSetsByDateRange } from '../db/queries';
import {
  type MuscleVolumeResult,
  type SetForVolume,
  type VolumeZone,
} from '../types';

const DIRECT_CREDIT = 1.0;
const INDIRECT_CREDIT = 0.5;

const effortMultiplier: Record<string, number> = {
  easy: 0.5,
  productive: 1,
  hard: 1,
  failure: 1,
};

function getRoleCredit(role: 'direct' | 'indirect'): number {
  return role === 'direct' ? DIRECT_CREDIT : INDIRECT_CREDIT;
}

function getZone(
  effectiveSets: number,
  thresholds: {
    mevLow: number;
    optimalLow: number;
    optimalHigh: number;
    mrvHigh: number;
  }
): VolumeZone {
  if (effectiveSets < thresholds.mevLow) {
    return 'RED';
  }

  if (effectiveSets < thresholds.optimalLow) {
    return 'YELLOW';
  }

  if (effectiveSets <= thresholds.optimalHigh) {
    return 'GREEN';
  }

  if (effectiveSets <= thresholds.mrvHigh) {
    return 'AMBER';
  }

  return 'ORANGE';
}

function roundToNearestHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export function calculateEffectiveSetsFromRawSets(
  sets: SetForVolume[]
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const set of sets) {
    if (set.isWarmup) {
      continue;
    }

    if (excludedFromDefaultHypertrophyVolume.has(set.exerciseId)) {
      continue;
    }

    const effort = effortMultiplier[set.effortLabel] ?? 1;
    const metconDiscount = metconDiscounts[set.exerciseId] ?? 1;

    for (const mapping of set.mappings) {
      const baseCredit = getRoleCredit(mapping.role);
      const effectiveCredit = baseCredit * effort * metconDiscount;
      const current = totals.get(mapping.muscleGroup) ?? 0;
      totals.set(mapping.muscleGroup, current + effectiveCredit);
    }
  }

  return totals;
}

export function buildMuscleVolumeResults(
  totals: Map<string, number>
): MuscleVolumeResult[] {
  return muscleGroups.map((group) => {
    const rawTotal = totals.get(group.id) ?? 0;
    const rounded = roundToNearestHalf(rawTotal);

    return {
      muscleGroupId: group.id,
      displayName: group.displayName,
      effectiveSets: rounded,
      zone: getZone(rawTotal, {
        mevLow: group.mevLow,
        optimalLow: group.optimalLow,
        optimalHigh: group.optimalHigh,
        mrvHigh: group.mrvHigh,
      }),
      thresholds: {
        mevLow: group.mevLow,
        mevHigh: group.mevHigh,
        optimalLow: group.optimalLow,
        optimalHigh: group.optimalHigh,
        mrvLow: group.mrvLow,
        mrvHigh: group.mrvHigh,
      },
    };
  });
}

export async function calculateVolumeForDateRange(
  startIso: string,
  endIso: string
): Promise<MuscleVolumeResult[]> {
  const sets = await getSetsByDateRange(startIso, endIso);
  const totals = calculateEffectiveSetsFromRawSets(sets);
  return buildMuscleVolumeResults(totals);
}
