import { getTrainingPhase } from '../src/utils/trainingPhase';

describe('trainingPhase', () => {
  it('returns neural phase under week 3', () => {
    const phase = getTrainingPhase(2.9);
    expect(phase.phase).toBe('neural');
    expect(phase.title).toContain('Neural');
  });

  it('returns transition phase from week 3 to under week 8', () => {
    const phase = getTrainingPhase(3);
    expect(phase.phase).toBe('transition');
    expect(phase.title).toContain('Transition');
  });

  it('returns hypertrophic phase from week 8 onward', () => {
    const phase = getTrainingPhase(8);
    expect(phase.phase).toBe('hypertrophic');
    expect(phase.title).toContain('Hypertrophy');
  });
});
