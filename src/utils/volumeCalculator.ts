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

export interface ExerciseContribution {
  exerciseId: string;
  exerciseName: string;
  effectiveSets: number;
  setCount: number;
}

export type ExerciseContributionsByMuscle = Record<string, ExerciseContribution[]>;

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

export function calculateExerciseContributionsByMuscle(
  sets: SetForVolume[]
): ExerciseContributionsByMuscle {
  interface Accumulator {
    exerciseName: string;
    effectiveSets: number;
    setCount: number;
  }
  const byMuscle = new Map<string, Map<string, Accumulator>>();

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
      if (effectiveCredit <= 0) {
        continue;
      }

      let exerciseMap = byMuscle.get(mapping.muscleGroup);
      if (!exerciseMap) {
        exerciseMap = new Map();
        byMuscle.set(mapping.muscleGroup, exerciseMap);
      }

      const existing = exerciseMap.get(set.exerciseId);
      if (existing) {
        existing.effectiveSets += effectiveCredit;
        existing.setCount += 1;
      } else {
        exerciseMap.set(set.exerciseId, {
          exerciseName: set.exerciseName,
          effectiveSets: effectiveCredit,
          setCount: 1,
        });
      }
    }
  }

  const result: ExerciseContributionsByMuscle = {};
  for (const [muscleGroupId, exerciseMap] of byMuscle.entries()) {
    const entries = Array.from(exerciseMap.entries())
      .map<ExerciseContribution>(([exerciseId, accumulator]) => ({
        exerciseId,
        exerciseName: accumulator.exerciseName,
        effectiveSets: roundToNearestHalf(accumulator.effectiveSets),
        setCount: accumulator.setCount,
      }))
      .sort((left, right) => {
        if (right.effectiveSets !== left.effectiveSets) {
          return right.effectiveSets - left.effectiveSets;
        }
        return left.exerciseName.localeCompare(right.exerciseName);
      });

    result[muscleGroupId] = entries;
  }

  return result;
}
