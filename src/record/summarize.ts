// Turns repeated readings into the schema's stats. Pure, so it can be tested without a browser.
import type { Stats } from '../shared/types';

// Nearest-rank percentile: the smallest reading that at least `share` of the readings are at or below.
// It always returns a real reading, never a value in between two.
function nearestRank(sorted: readonly number[], share: number): number {
  const rank = Math.max(1, Math.ceil(share * sorted.length));
  return sorted[rank - 1] as number;
}

// The middle reading, or the mean of the two middle readings when n is even.
function middle(sorted: readonly number[]): number {
  const half = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[half] as number;
  return ((sorted[half - 1] as number) + (sorted[half] as number)) / 2;
}

export function summarize(values: readonly number[]): Stats | null {
  const finite = values.filter((value) => Number.isFinite(value));
  // A NaN or Infinity means a reading went wrong, so refuse rather than hide it.
  if (finite.length !== values.length) {
    throw new Error('summarize got a reading that is not a finite number');
  }
  if (finite.length === 0) return null;
  const sorted = [...finite].sort((a, b) => a - b);
  return {
    n: sorted.length,
    min: sorted[0] as number,
    median: middle(sorted),
    p95: nearestRank(sorted, 0.95),
    max: sorted[sorted.length - 1] as number,
  };
}
