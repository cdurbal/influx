// The fixed duration buckets of D60 (02 §20.5, 0016): <= 25, 50, 100, 250, 500 ms, 1, 2.5, 5 s, and
// beyond. Shared by the recorder of the api (request metrics) and the worker (the probe and the p95
// of AL53, 15 RG165): histograms add up across instances, the p95 is computed at read time.

/** Upper bounds of the duration buckets, in ms; the ninth bucket is "beyond". */
export const DURATION_BUCKETS_MS = [
  25, 50, 100, 250, 500, 1000, 2500, 5000,
] as const;

/** Index of the bucket of a duration (0 to 8). */
export function bucketOf(durationMs: number): number {
  const index = DURATION_BUCKETS_MS.findIndex((bound) => durationMs <= bound);
  return index === -1 ? DURATION_BUCKETS_MS.length : index;
}

/**
 * The upper bound of the bucket that holds the 95th percentile of a histogram of nine buckets,
 * in ms; Infinity when it is the last one; null for an empty histogram. Exact for a threshold that
 * is one of the bounds (AL53: 1 s): "p95 > 1 s" is "the bucket of the p95 is beyond 1 s".
 */
export function p95UpperBoundMs(buckets: readonly number[]): number | null {
  const total = buckets.reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    return null;
  }
  const rank = Math.ceil(total * 0.95);
  let seen = 0;
  for (const [index, count] of buckets.entries()) {
    seen += count;
    if (seen >= rank) {
      return DURATION_BUCKETS_MS[index] ?? Number.POSITIVE_INFINITY;
    }
  }
  return Number.POSITIVE_INFINITY;
}
