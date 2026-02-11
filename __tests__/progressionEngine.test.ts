import { evaluateDoubleProgression } from '../src/utils/progressionEngine';

describe('evaluateDoubleProgression', () => {
  it('suggests load increase after two qualifying exposures', () => {
    const result = evaluateDoubleProgression({
      exerciseId: 'barbell-bench-press',
      exposures: [
        {
          workoutId: 'w2',
          completedAt: '2026-01-08T00:00:00.000Z',
          targetRepHigh: 10,
          workingSetReps: [10, 10],
          topLoadKg: 80,
        },
        {
          workoutId: 'w1',
          completedAt: '2026-01-01T00:00:00.000Z',
          targetRepHigh: 10,
          workingSetReps: [11, 10],
          topLoadKg: 77.5,
        },
      ],
    });

    expect(result).not.toBeNull();
    expect(result?.suggestedLoadKg).toBe(82.5);
    expect(result?.increasePercent).toBe(2.5);
  });

  it('returns null without two qualifying exposures', () => {
    const result = evaluateDoubleProgression({
      exerciseId: 'barbell-bench-press',
      exposures: [
        {
          workoutId: 'w2',
          completedAt: '2026-01-08T00:00:00.000Z',
          targetRepHigh: 10,
          workingSetReps: [10, 8],
          topLoadKg: 80,
        },
      ],
    });

    expect(result).toBeNull();
  });
});
