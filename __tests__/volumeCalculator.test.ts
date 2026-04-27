import {
  buildMuscleVolumeResults,
  calculateEffectiveSetsFromRawSets,
  calculateExerciseContributionsByMuscle,
} from '../src/utils/volumeCalculator';
import type { SetForVolume } from '../src/types';

describe('volumeCalculator', () => {
  it('applies direct and indirect role credits', () => {
    const rows: SetForVolume[] = [
      {
        setId: 1,
        exerciseId: 'barbell-bench-press',
        exerciseName: 'Bench Press',
        category: 'compound',
        reps: 8,
        loadKg: 80,
        effortLabel: 'hard',
        isWarmup: false,
        loggedAt: '2026-01-01T00:00:00.000Z',
        mappings: [
          { muscleGroup: 'chest', role: 'direct' },
          { muscleGroup: 'triceps', role: 'indirect' },
        ],
      },
    ];

    const totals = calculateEffectiveSetsFromRawSets(rows);
    expect(totals.get('chest')).toBeCloseTo(1);
    expect(totals.get('triceps')).toBeCloseTo(0.5);
  });

  it('applies effort multiplier and metcon discount', () => {
    const rows: SetForVolume[] = [
      {
        setId: 2,
        exerciseId: 'box-step-overs',
        exerciseName: 'Box Step-Overs',
        category: 'metcon',
        reps: 1,
        loadKg: 0,
        effortLabel: 'easy',
        isWarmup: false,
        loggedAt: '2026-01-01T00:00:00.000Z',
        mappings: [{ muscleGroup: 'quads', role: 'direct' }],
      },
    ];

    const totals = calculateEffectiveSetsFromRawSets(rows);
    expect(totals.get('quads')).toBeCloseTo(0.175);
  });

  it('assigns zones from rounded effective sets', () => {
    const totals = new Map<string, number>([
      ['quads', 6.2],
      ['chest', 1.9],
    ]);
    const results = buildMuscleVolumeResults(totals);

    const quads = results.find((result) => result.muscleGroupId === 'quads');
    const chest = results.find((result) => result.muscleGroupId === 'chest');

    expect(quads?.effectiveSets).toBe(6);
    expect(quads?.zone).toBe('GREEN');

    expect(chest?.effectiveSets).toBe(2);
    expect(chest?.zone).toBe('RED');
  });

  describe('calculateExerciseContributionsByMuscle', () => {
    it('groups effective sets by muscle and exercise, sorted by contribution', () => {
      const rows: SetForVolume[] = [
        {
          setId: 1,
          exerciseId: 'barbell-bench-press',
          exerciseName: 'Bench Press',
          category: 'compound',
          reps: 8,
          loadKg: 80,
          effortLabel: 'hard',
          isWarmup: false,
          loggedAt: '2026-01-01T00:00:00.000Z',
          mappings: [
            { muscleGroup: 'chest', role: 'direct' },
            { muscleGroup: 'triceps', role: 'indirect' },
          ],
        },
        {
          setId: 2,
          exerciseId: 'barbell-bench-press',
          exerciseName: 'Bench Press',
          category: 'compound',
          reps: 6,
          loadKg: 85,
          effortLabel: 'hard',
          isWarmup: false,
          loggedAt: '2026-01-01T00:10:00.000Z',
          mappings: [
            { muscleGroup: 'chest', role: 'direct' },
            { muscleGroup: 'triceps', role: 'indirect' },
          ],
        },
        {
          setId: 3,
          exerciseId: 'cable-crossover',
          exerciseName: 'Cable Crossover',
          category: 'isolation',
          reps: 12,
          loadKg: 20,
          effortLabel: 'productive',
          isWarmup: false,
          loggedAt: '2026-01-01T00:20:00.000Z',
          mappings: [{ muscleGroup: 'chest', role: 'direct' }],
        },
      ];

      const breakdown = calculateExerciseContributionsByMuscle(rows);

      const chestContributions = breakdown.chest;
      expect(chestContributions).toBeDefined();
      expect(chestContributions[0]?.exerciseId).toBe('barbell-bench-press');
      expect(chestContributions[0]?.effectiveSets).toBe(2);
      expect(chestContributions[0]?.setCount).toBe(2);
      expect(chestContributions[1]?.exerciseId).toBe('cable-crossover');
      expect(chestContributions[1]?.effectiveSets).toBe(1);

      const tricepsContributions = breakdown.triceps;
      expect(tricepsContributions[0]?.exerciseId).toBe('barbell-bench-press');
      expect(tricepsContributions[0]?.effectiveSets).toBe(1);
      expect(tricepsContributions[0]?.setCount).toBe(2);
    });

    it('skips warmup sets and excluded exercises', () => {
      const rows: SetForVolume[] = [
        {
          setId: 1,
          exerciseId: 'dead-hang-passive',
          exerciseName: 'Dead Hang',
          category: 'mobility',
          reps: 60,
          loadKg: 0,
          effortLabel: 'hard',
          isWarmup: false,
          loggedAt: '2026-01-01T00:00:00.000Z',
          mappings: [{ muscleGroup: 'forearms', role: 'direct' }],
        },
        {
          setId: 2,
          exerciseId: 'barbell-bench-press',
          exerciseName: 'Bench Press',
          category: 'compound',
          reps: 5,
          loadKg: 60,
          effortLabel: 'hard',
          isWarmup: true,
          loggedAt: '2026-01-01T00:10:00.000Z',
          mappings: [{ muscleGroup: 'chest', role: 'direct' }],
        },
      ];

      const breakdown = calculateExerciseContributionsByMuscle(rows);
      expect(breakdown).toEqual({});
    });
  });
});
