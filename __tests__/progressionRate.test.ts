import {
  calculateProgressionRate,
  linearRegressionSlope,
} from '../src/utils/progressionRate';
import type { StrengthTrendPoint } from '../src/types';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const baseDateMs = Date.UTC(2026, 0, 1, 12, 0, 0);

function makePoint(input: {
  exerciseId: string;
  exerciseName: string;
  week: number;
  loadKg: number;
  reps: number;
}): StrengthTrendPoint {
  return {
    workoutId: `${input.exerciseId}-${input.week}`,
    exerciseId: input.exerciseId,
    exerciseName: input.exerciseName,
    completedAt: new Date(baseDateMs + input.week * ONE_WEEK_MS).toISOString(),
    bestSetLoadKg: input.loadKg,
    bestSetReps: input.reps,
  };
}

describe('progressionRate', () => {
  it('computes least-squares slope', () => {
    const slope = linearRegressionSlope([
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ]);

    expect(slope).toBeCloseTo(2, 6);
  });

  it('returns not-enough-data state when there are too few sessions', () => {
    const points = [
      makePoint({
        exerciseId: 'barbell-bench-press',
        exerciseName: 'Barbell Bench Press',
        week: 0,
        loadKg: 60,
        reps: 8,
      }),
      makePoint({
        exerciseId: 'barbell-bench-press',
        exerciseName: 'Barbell Bench Press',
        week: 1,
        loadKg: 62.5,
        reps: 8,
      }),
      makePoint({
        exerciseId: 'barbell-bench-press',
        exerciseName: 'Barbell Bench Press',
        week: 3,
        loadKg: 65,
        reps: 8,
      }),
    ];

    const result = calculateProgressionRate('barbell-bench-press', points);
    expect(result.hasEnoughData).toBe(false);
    expect(result.actualRateKgPerWeek).toBe(0);
  });

  it('computes progression rate and stage reference for bench', () => {
    const points = [0, 2, 4, 6, 8].map((week, index) =>
      makePoint({
        exerciseId: 'barbell-bench-press',
        exerciseName: 'Barbell Bench Press',
        week,
        loadKg: 70 + index * 2,
        reps: 1,
      })
    );

    const result = calculateProgressionRate('barbell-bench-press', points);
    expect(result.hasEnoughData).toBe(true);
    expect(result.weeksOfData).toBeCloseTo(8, 6);
    expect(result.actualRateKgPerWeek).toBeGreaterThan(1);
    expect(result.referenceRateKgPerWeek).toBeCloseTo(1.25, 6);
    expect(result.referenceLabel).toContain('Ogasawara');
    expect(result.referenceCaveat).toContain('Single small study');
  });

  it('returns squat reference average when data is sufficient', () => {
    const points = [0, 3, 6, 9].map((week, index) =>
      makePoint({
        exerciseId: 'barbell-back-squat',
        exerciseName: 'Barbell Back Squat',
        week,
        loadKg: 100 + index * 5,
        reps: 2,
      })
    );

    const result = calculateProgressionRate('barbell-back-squat', points);
    expect(result.hasEnoughData).toBe(true);
    expect(result.referenceRateKgPerWeek).toBeCloseTo(1.74, 6);
    expect(result.referenceLabel).toContain('Spence');
  });
});
