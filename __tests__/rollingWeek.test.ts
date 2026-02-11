import { getRollingWeekWindow } from '../src/utils/rollingWeek';

describe('getRollingWeekWindow', () => {
  it('returns week zero at anchor', () => {
    const anchor = '2026-01-01T00:00:00.000Z';
    const window = getRollingWeekWindow(anchor, anchor);

    expect(window.weekNumber).toBe(0);
    expect(window.startIso).toBe(anchor);
  });

  it('advances in 7-day intervals', () => {
    const anchor = '2026-01-01T00:00:00.000Z';
    const current = '2026-01-15T00:00:01.000Z';
    const window = getRollingWeekWindow(current, anchor);

    expect(window.weekNumber).toBe(2);
    expect(window.startIso).toBe('2026-01-15T00:00:00.000Z');
    expect(window.endIso).toBe('2026-01-22T00:00:00.000Z');
  });
});
