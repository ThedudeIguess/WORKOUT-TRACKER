import { estimateOneRepMax } from '../src/utils/oneRepMax';

describe('estimateOneRepMax', () => {
  it('uses Epley formula', () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.666, 2);
  });

  it('returns zero for invalid input', () => {
    expect(estimateOneRepMax(-10, 5)).toBe(0);
    expect(estimateOneRepMax(100, 0)).toBe(0);
  });
});
