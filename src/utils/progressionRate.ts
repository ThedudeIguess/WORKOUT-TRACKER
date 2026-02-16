import { progressionReferences } from '../constants/progressionReferences';
import type { ProgressionRateResult, StrengthTrendPoint } from '../types';
import { estimateOneRepMax } from './oneRepMax';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_SESSIONS_FOR_RATE = 4;
const MIN_WEEKS_FOR_RATE = 2;

interface RegressionPoint {
  x: number;
  y: number;
}

function parseIsoToMs(iso: string): number {
  const parsed = new Date(iso).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getReferenceForWeek(exerciseId: string, week: number): {
  rateKgPerWeek: number;
  caveat: string;
  label: string;
} | null {
  const reference = progressionReferences.find((entry) => entry.exerciseId === exerciseId);
  if (!reference) {
    return null;
  }

  const matchingSegment = reference.segments.find(
    (segment) => week >= segment.fromWeek && week < segment.toWeek
  );

  if (matchingSegment) {
    return {
      rateKgPerWeek: matchingSegment.rateKgPerWeek,
      caveat: reference.caveat,
      label: reference.label,
    };
  }

  const finalSegment = reference.segments[reference.segments.length - 1] ?? null;
  if (!finalSegment) {
    return null;
  }

  return {
    rateKgPerWeek: finalSegment.rateKgPerWeek,
    caveat: reference.caveat,
    label: reference.label,
  };
}

export function linearRegressionSlope(points: RegressionPoint[]): number {
  const n = points.length;
  if (n < 2) {
    return 0;
  }

  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumX2 = points.reduce((sum, point) => sum + point.x * point.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) {
    return 0;
  }

  return (n * sumXY - sumX * sumY) / denom;
}

export function calculateProgressionRate(
  exerciseId: string,
  series: StrengthTrendPoint[]
): ProgressionRateResult {
  if (series.length === 0) {
    return {
      exerciseId,
      actualRateKgPerWeek: 0,
      weeksOfData: 0,
      sessionCount: 0,
      referenceRateKgPerWeek: null,
      referenceCaveat: null,
      referenceLabel: null,
      hasEnoughData: false,
    };
  }

  const sortedSeries = [...series].sort((a, b) =>
    a.completedAt.localeCompare(b.completedAt)
  );
  const firstSessionAtMs = parseIsoToMs(sortedSeries[0]?.completedAt ?? '');
  const lastSessionAtMs = parseIsoToMs(
    sortedSeries[sortedSeries.length - 1]?.completedAt ?? ''
  );
  const weeksOfData = Math.max(0, (lastSessionAtMs - firstSessionAtMs) / ONE_WEEK_MS);

  const regressionPoints: RegressionPoint[] = sortedSeries.map((point) => {
    const sessionAtMs = parseIsoToMs(point.completedAt);
    const weeksSinceFirst = Math.max(0, (sessionAtMs - firstSessionAtMs) / ONE_WEEK_MS);
    return {
      x: weeksSinceFirst,
      y: estimateOneRepMax(point.bestSetLoadKg, point.bestSetReps),
    };
  });

  const hasEnoughData =
    sortedSeries.length >= MIN_SESSIONS_FOR_RATE && weeksOfData >= MIN_WEEKS_FOR_RATE;
  const actualRateKgPerWeek = hasEnoughData ? linearRegressionSlope(regressionPoints) : 0;
  const reference = getReferenceForWeek(exerciseId, weeksOfData);

  return {
    exerciseId,
    actualRateKgPerWeek,
    weeksOfData,
    sessionCount: sortedSeries.length,
    referenceRateKgPerWeek: reference?.rateKgPerWeek ?? null,
    referenceCaveat: reference?.caveat ?? null,
    referenceLabel: reference?.label ?? null,
    hasEnoughData,
  };
}
