import type { MuscleVolumeResult } from '../src/types';
import {
  calculateMuscleProgressionHistoryFromWeeks,
  getAllMuscleProgressionsFromWeeks,
  identifyLaggingMuscles,
  summarizeWeekVolumeAgainstMev,
} from '../src/utils/mevTrainingWeek';

function buildResult(
  muscleGroupId: string,
  effectiveSets: number,
  mevLow: number
): MuscleVolumeResult {
  return {
    muscleGroupId,
    displayName: muscleGroupId,
    effectiveSets,
    zone: 'GREEN',
    thresholds: {
      mevLow,
      mevHigh: mevLow + 1,
      optimalLow: mevLow + 2,
      optimalHigh: mevLow + 4,
      mrvLow: mevLow + 5,
      mrvHigh: mevLow + 7,
    },
  };
}

describe('summarizeWeekVolumeAgainstMev', () => {
  it('qualifies when group-averaged ratio is >= 1.0', () => {
    const results: MuscleVolumeResult[] = [
      // Lower body group
      buildResult('quads', 3, 3), // 1.0
      buildResult('hamstrings', 3, 3), // 1.0
      buildResult('glutes', 3, 3), // 1.0
      // Upper body group
      buildResult('chest', 2, 2), // 1.0
      buildResult('front-delts', 2, 2), // 1.0
      buildResult('side-delts', 2, 2), // 1.0
      // Back group
      buildResult('lats', 2, 2), // 1.0
      buildResult('upper-back', 2, 2), // 1.0
      buildResult('rear-delts', 2, 2), // 1.0
      buildResult('lower-traps', 2, 2), // 1.0
      // Arms group
      buildResult('biceps', 2, 2), // 1.0
      buildResult('triceps', 3, 3), // 1.0
      buildResult('forearms', 2, 2), // 1.0
    ];

    const summary = summarizeWeekVolumeAgainstMev(
      3,
      '2026-01-01T10:00:00.000Z',
      '2026-01-08T10:00:00.000Z',
      results
    );

    expect(summary.averageMevRatio).toBeCloseTo(1, 3);
    expect(summary.averageMevPercent).toBe(100);
    expect(summary.qualifiesAsTrainingWeek).toBe(true);
    expect(summary.coverageGroups).toHaveLength(4);
  });

  it('does not qualify when group-averaged ratio is < 1.0', () => {
    const results: MuscleVolumeResult[] = [
      // Lower body group
      buildResult('quads', 1.5, 3), // 0.5
      buildResult('hamstrings', 1.5, 3), // 0.5
      buildResult('glutes', 1.5, 3), // 0.5
      // Upper body group
      buildResult('chest', 1, 2), // 0.5
      buildResult('front-delts', 1, 2), // 0.5
      buildResult('side-delts', 1, 2), // 0.5
      // Back group
      buildResult('lats', 1, 2), // 0.5
      buildResult('upper-back', 1, 2), // 0.5
      buildResult('rear-delts', 1, 2), // 0.5
      buildResult('lower-traps', 1, 2), // 0.5
      // Arms group
      buildResult('biceps', 1, 2), // 0.5
      buildResult('triceps', 1.5, 3), // 0.5
      buildResult('forearms', 1, 2), // 0.5
    ];

    const summary = summarizeWeekVolumeAgainstMev(
      2,
      '2026-01-08T10:00:00.000Z',
      '2026-01-15T10:00:00.000Z',
      results
    );

    expect(summary.averageMevRatio).toBeCloseTo(0.5, 3);
    expect(summary.averageMevPercent).toBe(50);
    expect(summary.qualifiesAsTrainingWeek).toBe(false);
  });

  it('keeps muscle week number flat on missed-MEV weeks', () => {
    const week1 = summarizeWeekVolumeAgainstMev(
      1,
      '2026-01-01T10:00:00.000Z',
      '2026-01-08T10:00:00.000Z',
      [buildResult('biceps', 2, 2)]
    );
    const week2 = summarizeWeekVolumeAgainstMev(
      2,
      '2026-01-08T10:00:00.000Z',
      '2026-01-15T10:00:00.000Z',
      [buildResult('biceps', 1, 2)]
    );
    const week3 = summarizeWeekVolumeAgainstMev(
      3,
      '2026-01-15T10:00:00.000Z',
      '2026-01-22T10:00:00.000Z',
      [buildResult('biceps', 2, 2)]
    );

    const muscleHistory = calculateMuscleProgressionHistoryFromWeeks(
      [week1, week2, week3],
      'biceps'
    );

    expect(muscleHistory).not.toBeNull();
    expect(muscleHistory?.weeks[0]?.muscleWeekNumber).toBe(1);
    expect(muscleHistory?.weeks[1]?.muscleWeekNumber).toBe(1);
    expect(muscleHistory?.weeks[2]?.muscleWeekNumber).toBe(2);
  });

  it('identifies lagging muscles using opportunity-adjusted hit rate', () => {
    const week1 = summarizeWeekVolumeAgainstMev(
      1,
      '2026-01-01T10:00:00.000Z',
      '2026-01-08T10:00:00.000Z',
      [
        buildResult('triceps', 3, 3), // hit
        buildResult('abs', 2, 2), // hit
      ]
    );
    const week2 = summarizeWeekVolumeAgainstMev(
      2,
      '2026-01-08T10:00:00.000Z',
      '2026-01-15T10:00:00.000Z',
      [
        buildResult('triceps', 3, 3), // hit
        buildResult('abs', 1, 2), // miss
      ]
    );
    const week3 = summarizeWeekVolumeAgainstMev(
      3,
      '2026-01-15T10:00:00.000Z',
      '2026-01-22T10:00:00.000Z',
      [
        buildResult('triceps', 3, 3), // hit
        buildResult('abs', 1, 2), // miss
      ]
    );

    const allProgressions = getAllMuscleProgressionsFromWeeks([
      week1,
      week2,
      week3,
    ]);
    const lagging = identifyLaggingMuscles(allProgressions, 3);

    expect(
      lagging.some(
        (result) =>
          result.muscleGroupId === 'abs' &&
          result.weeksBehindExpected >= 1
      )
    ).toBe(true);
    expect(
      lagging.some((result) => result.muscleGroupId === 'triceps')
    ).toBe(false);
  });
});
