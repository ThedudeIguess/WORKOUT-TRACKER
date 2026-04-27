import { muscleGroups } from '../constants/mevThresholds';
import { getSetsByDateRange } from '../db/queries';
import type { MuscleVolumeResult, VolumeZone } from '../types';
import { getRollingWeekWindow } from './rollingWeek';
import { getTrainingPhase } from './trainingPhase';
import {
  buildMuscleVolumeResults,
  calculateEffectiveSetsFromRawSets,
  calculateExerciseContributionsByMuscle,
  type ExerciseContributionsByMuscle,
} from './volumeCalculator';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TRAINING_WEEK_THRESHOLD_RATIO = 1;

export const TRAINING_WEEK_MUSCLE_IDS = [
  'quads',
  'chest',
  'triceps',
  'biceps',
  'glutes',
  'lats',
] as const;

export const MEV_COVERAGE_GROUPS = [
  {
    id: 'lower-body',
    label: 'Lower Body',
    muscleIds: ['quads', 'hamstrings', 'glutes'],
  },
  {
    id: 'upper-body',
    label: 'Upper Body',
    muscleIds: ['chest', 'front-delts', 'side-delts'],
  },
  {
    id: 'back',
    label: 'Back',
    muscleIds: ['lats', 'upper-back', 'rear-delts', 'lower-traps'],
  },
  {
    id: 'arms',
    label: 'Arms',
    muscleIds: ['biceps', 'triceps', 'forearms'],
  },
] as const;

export interface TrackedMuscleMevCoverage {
  muscleGroupId: string;
  displayName: string;
  effectiveSets: number;
  mevLow: number;
  ratio: number;
}

export interface MevWeekSummary {
  weekNumber: number;
  startIso: string;
  endIso: string;
  averageMevRatio: number;
  averageMevPercent: number;
  qualifiesAsTrainingWeek: boolean;
  coverageGroups: {
    groupId: string;
    label: string;
    averageRatio: number;
    averagePercent: number;
    muscles: TrackedMuscleMevCoverage[];
  }[];
  trackedMuscles: TrackedMuscleMevCoverage[];
  results: MuscleVolumeResult[];
  exerciseContributionsByMuscle: ExerciseContributionsByMuscle;
}

export interface MevTrainingHistory {
  calendarWeekNumber: number;
  trainingWeekNumber: number;
  qualifiedWeeks: number;
  totalWeeks: number;
  currentWeek: MevWeekSummary | null;
  weeks: MevWeekSummary[];
}

export interface MuscleWeekStatus {
  calendarWeekNumber: number;
  startIso: string;
  endIso: string;
  effectiveSets: number;
  mevLow: number;
  ratio: number;
  percentOfMev: number;
  zone: VolumeZone;
  hitMev: boolean;
  muscleWeekNumber: number;
}

export interface MuscleProgressionHistory {
  muscleGroupId: string;
  displayName: string;
  currentMuscleWeekNumber: number;
  currentPhase: ReturnType<typeof getTrainingPhase>;
  currentWeek: MuscleWeekStatus | null;
  hitWeeks: number;
  activeWeeks: number;
  hitRate: number;
  progressionIndex: number;
  weeks: MuscleWeekStatus[];
}

export interface LaggingMuscleResult {
  muscleGroupId: string;
  displayName: string;
  hitWeeks: number;
  activeWeeks: number;
  hitRate: number;
  progressionIndex: number;
  weeksBehindExpected: number;
}

function toPercent(value: number): number {
  return Math.round(value * 100);
}

export function summarizeWeekVolumeAgainstMev(
  weekNumber: number,
  startIso: string,
  endIso: string,
  results: MuscleVolumeResult[],
  trackedMuscleIds: readonly string[] = TRAINING_WEEK_MUSCLE_IDS,
  exerciseContributionsByMuscle: ExerciseContributionsByMuscle = {}
): MevWeekSummary {
  const resultByMuscleId = new Map(
    results.map((result) => [result.muscleGroupId, result])
  );
  const defaultMevLowByMuscleId = new Map(
    muscleGroups.map((group) => [group.id, group.mevLow])
  );

  const trackedMuscles: TrackedMuscleMevCoverage[] = trackedMuscleIds
    .map((muscleId) => {
      const result = resultByMuscleId.get(muscleId);
      if (!result) {
        return null;
      }

      const mevLow = result.thresholds.mevLow;
      const ratio = mevLow > 0 ? result.effectiveSets / mevLow : 0;

      return {
        muscleGroupId: result.muscleGroupId,
        displayName: result.displayName,
        effectiveSets: result.effectiveSets,
        mevLow,
        ratio,
      };
    })
    .filter((value): value is TrackedMuscleMevCoverage => value !== null);

  const coverageGroups = MEV_COVERAGE_GROUPS.map((group) => {
    const muscles = group.muscleIds
      .map((muscleId) => {
        const result = resultByMuscleId.get(muscleId);
        const mevLow = result?.thresholds.mevLow ?? defaultMevLowByMuscleId.get(muscleId) ?? 0;
        const effectiveSets = result?.effectiveSets ?? 0;
        const ratio = mevLow > 0 ? effectiveSets / mevLow : 0;

        return {
          muscleGroupId: muscleId,
          displayName:
            result?.displayName ??
            muscleGroups.find((muscle) => muscle.id === muscleId)?.displayName ??
            muscleId,
          effectiveSets,
          mevLow,
          ratio,
        };
      })
      .filter((muscle) => muscle.mevLow > 0);

    const averageRatio =
      muscles.length > 0
        ? muscles.reduce((sum, item) => sum + item.ratio, 0) / muscles.length
        : 0;

    return {
      groupId: group.id,
      label: group.label,
      averageRatio,
      averagePercent: toPercent(averageRatio),
      muscles,
    };
  });

  const averageMevRatio =
    coverageGroups.length > 0
      ? coverageGroups.reduce((sum, group) => sum + group.averageRatio, 0) /
        coverageGroups.length
      : 0;

  return {
    weekNumber,
    startIso,
    endIso,
    averageMevRatio,
    averageMevPercent: toPercent(averageMevRatio),
    qualifiesAsTrainingWeek: averageMevRatio >= TRAINING_WEEK_THRESHOLD_RATIO,
    coverageGroups,
    trackedMuscles,
    results,
    exerciseContributionsByMuscle,
  };
}

export async function calculateMevTrainingHistory(
  anchorIso: string,
  currentIso: string
): Promise<MevTrainingHistory> {
  const anchorMs = new Date(anchorIso).getTime();
  const currentMs = new Date(currentIso).getTime();

  if (!Number.isFinite(anchorMs) || !Number.isFinite(currentMs)) {
    throw new Error('Invalid dates provided for MEV training history.');
  }

  const currentWindow = getRollingWeekWindow(currentIso, anchorIso);
  const totalWeeks = currentWindow.weekNumber + 1;
  const weeks: MevWeekSummary[] = [];
  const rangeEndIso = new Date(anchorMs + totalWeeks * ONE_WEEK_MS).toISOString();
  const allSets = await getSetsByDateRange(anchorIso, rangeEndIso);
  const setsByWeek = new Map<number, typeof allSets>();

  for (const set of allSets) {
    const loggedAtMs = new Date(set.loggedAt).getTime();
    if (!Number.isFinite(loggedAtMs)) {
      continue;
    }

    const weekIndex = Math.floor((loggedAtMs - anchorMs) / ONE_WEEK_MS);
    if (weekIndex < 0 || weekIndex >= totalWeeks) {
      continue;
    }

    const bucket = setsByWeek.get(weekIndex) ?? [];
    bucket.push(set);
    setsByWeek.set(weekIndex, bucket);
  }

  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex += 1) {
    const startMs = anchorMs + weekIndex * ONE_WEEK_MS;
    const endMs = startMs + ONE_WEEK_MS;
    const startIso = new Date(startMs).toISOString();
    const endIso = new Date(endMs).toISOString();
    const weekSets = setsByWeek.get(weekIndex) ?? [];
    const results = buildMuscleVolumeResults(
      calculateEffectiveSetsFromRawSets(weekSets)
    );
    const contributions = calculateExerciseContributionsByMuscle(weekSets);

    weeks.push(
      summarizeWeekVolumeAgainstMev(
        weekIndex + 1,
        startIso,
        endIso,
        results,
        TRAINING_WEEK_MUSCLE_IDS,
        contributions
      )
    );
  }

  const qualifiedWeeks = weeks.filter(
    (week) => week.qualifiesAsTrainingWeek
  ).length;

  return {
    calendarWeekNumber: currentWindow.weekNumber + 1,
    trainingWeekNumber: qualifiedWeeks,
    qualifiedWeeks,
    totalWeeks: weeks.length,
    currentWeek: weeks[weeks.length - 1] ?? null,
    weeks,
  };
}

export function calculateMuscleProgressionHistoryFromWeeks(
  weeks: MevWeekSummary[],
  muscleGroupId: string
): MuscleProgressionHistory | null {
  const muscleMeta = muscleGroups.find((muscle) => muscle.id === muscleGroupId);
  const defaultMevLow = muscleMeta?.mevLow ?? 0;
  const displayName = muscleMeta?.displayName ?? muscleGroupId;

  if (defaultMevLow <= 0) {
    return null;
  }

  let muscleWeekNumber = 0;
  let activeWeeks = 0;
  const statuses: MuscleWeekStatus[] = weeks.map((week) => {
    const result = week.results.find(
      (entry) => entry.muscleGroupId === muscleGroupId
    );
    const effectiveSets = result?.effectiveSets ?? 0;
    const mevLow = result?.thresholds.mevLow ?? defaultMevLow;
    const ratio = mevLow > 0 ? effectiveSets / mevLow : 0;
    const hitMev = ratio >= 1;
    const isActiveWeek = effectiveSets > 0;

    if (isActiveWeek) {
      activeWeeks += 1;
    }

    if (hitMev) {
      muscleWeekNumber += 1;
    }

    return {
      calendarWeekNumber: week.weekNumber,
      startIso: week.startIso,
      endIso: week.endIso,
      effectiveSets,
      mevLow,
      ratio,
      percentOfMev: toPercent(ratio),
      zone: result?.zone ?? 'RED',
      hitMev,
      muscleWeekNumber,
    };
  });

  const currentWeek = statuses[statuses.length - 1] ?? null;
  const hitWeeks = muscleWeekNumber;
  const hitRate = activeWeeks > 0 ? hitWeeks / activeWeeks : 0;
  const progressionIndex = hitRate;

  return {
    muscleGroupId,
    displayName,
    currentMuscleWeekNumber: currentWeek?.muscleWeekNumber ?? 0,
    currentPhase: getTrainingPhase(
      Math.max(0, (currentWeek?.muscleWeekNumber ?? 0) - 1)
    ),
    currentWeek,
    hitWeeks,
    activeWeeks,
    hitRate,
    progressionIndex,
    weeks: statuses,
  };
}

export function getAllMuscleProgressionsFromWeeks(
  weeks: MevWeekSummary[]
): MuscleProgressionHistory[] {
  return muscleGroups
    .map((muscle) =>
      calculateMuscleProgressionHistoryFromWeeks(weeks, muscle.id)
    )
    .filter((item): item is MuscleProgressionHistory => item !== null);
}

export function identifyLaggingMuscles(
  progressions: MuscleProgressionHistory[],
  minimumActiveWeeks = 3
): LaggingMuscleResult[] {
  const eligible = progressions.filter(
    (progression) => progression.activeWeeks >= minimumActiveWeeks
  );

  if (eligible.length === 0) {
    return [];
  }

  const topProgressionIndex = Math.max(
    ...eligible.map((progression) => progression.progressionIndex)
  );

  return eligible
    .map((progression) => {
      const expectedHitWeeks = topProgressionIndex * progression.activeWeeks;
      const weeksBehindExpected = Math.max(
        0,
        expectedHitWeeks - progression.hitWeeks
      );

      return {
        muscleGroupId: progression.muscleGroupId,
        displayName: progression.displayName,
        hitWeeks: progression.hitWeeks,
        activeWeeks: progression.activeWeeks,
        hitRate: progression.hitRate,
        progressionIndex: progression.progressionIndex,
        weeksBehindExpected,
      };
    })
    .filter((result) => result.weeksBehindExpected >= 1)
    .sort((left, right) => {
      const lagDelta = right.weeksBehindExpected - left.weeksBehindExpected;
      if (lagDelta !== 0) {
        return lagDelta;
      }

      return left.displayName.localeCompare(right.displayName);
    });
}
