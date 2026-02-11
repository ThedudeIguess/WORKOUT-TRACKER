import { exerciseMuscleMappings } from '../constants/exercises';
import { getRecentExerciseExposures } from '../db/queries';
import {
  type ProgressionExposure,
  type ProgressionSuggestion,
} from '../types';

const LOWER_BODY_MUSCLES = new Set(['quads', 'hamstrings', 'glutes']);

function roundToIncrement(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

function isLowerBodyExercise(exerciseId: string): boolean {
  return exerciseMuscleMappings.some(
    (mapping) =>
      mapping.exerciseId === exerciseId &&
      mapping.role === 'direct' &&
      LOWER_BODY_MUSCLES.has(mapping.muscleGroup)
  );
}

export function evaluateDoubleProgression(input: {
  exerciseId: string;
  exposures: ProgressionExposure[];
}): ProgressionSuggestion | null {
  const { exerciseId, exposures } = input;

  if (exposures.length < 2) {
    return null;
  }

  const [latest, previous] = exposures;

  const isExposureQualified = (exposure: ProgressionExposure): boolean => {
    if (exposure.workingSetReps.length < 2) {
      return false;
    }

    const qualifyingSets = exposure.workingSetReps.filter(
      (reps) => reps >= exposure.targetRepHigh
    );

    return qualifyingSets.length >= 2;
  };

  if (!isExposureQualified(latest) || !isExposureQualified(previous)) {
    return null;
  }

  const lowerBody = isLowerBodyExercise(exerciseId);
  const increasePercent = lowerBody ? 5 : 2.5;
  const increment = lowerBody ? 2.5 : 1.25;
  const baseLoad = Math.max(latest.topLoadKg, previous.topLoadKg);
  const suggestedLoadKg = roundToIncrement(
    baseLoad * (1 + increasePercent / 100),
    increment
  );

  return {
    exerciseId,
    suggestedLoadKg,
    increasePercent,
    reason:
      'Top rep range was hit for both working sets across two consecutive exposures.',
  };
}

export async function getProgressionSuggestion(
  exerciseId: string
): Promise<ProgressionSuggestion | null> {
  const exposures = await getRecentExerciseExposures(exerciseId, 2);
  return evaluateDoubleProgression({ exerciseId, exposures });
}
