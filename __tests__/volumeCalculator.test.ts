import {
  buildMuscleVolumeResults,
  calculateEffectiveSetsFromRawSets,
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
});
