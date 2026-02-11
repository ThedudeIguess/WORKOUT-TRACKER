import type { RollingWeekWindow } from '../types';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function getRollingWeekWindow(
  currentIso: string,
  anchorIso: string
): RollingWeekWindow {
  const current = new Date(currentIso).getTime();
  const anchor = new Date(anchorIso).getTime();

  if (!Number.isFinite(current) || !Number.isFinite(anchor)) {
    throw new Error('Invalid date input for rolling week calculation.');
  }

  const elapsedMs = Math.max(0, current - anchor);
  const weekNumber = Math.floor(elapsedMs / ONE_WEEK_MS);
  const startMs = anchor + weekNumber * ONE_WEEK_MS;
  const endMs = startMs + ONE_WEEK_MS;

  return {
    weekNumber,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  };
}
