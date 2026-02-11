export function estimateOneRepMax(loadKg: number, reps: number): number {
  if (!Number.isFinite(loadKg) || !Number.isFinite(reps)) {
    return 0;
  }

  if (loadKg < 0 || reps <= 0) {
    return 0;
  }

  return loadKg * (1 + reps / 30);
}
