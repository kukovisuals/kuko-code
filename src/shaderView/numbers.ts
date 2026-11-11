// Small pure statistics used by the live panel and the cost map.

export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;
  return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

export function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))] as number;
}

// Replaces values with their sorted position. Tied values share the average of their positions.
function ranks(values: readonly number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = new Array<number>(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (end + 1 < order.length && order[end + 1]?.value === order[start]?.value) end += 1;
    for (let i = start; i <= end; i++) result[(order[i] as { index: number }).index] = (start + end) / 2;
    start = end + 1;
  }
  return result;
}

// Spearman correlation: asks whether one list rises with the other, whatever the sizes. One spike
// is just one high rank, so it can't dominate the result the way it can with Pearson.
export function rankCorrelation(a: readonly number[], b: readonly number[]): number {
  return correlation(ranks(a), ranks(b));
}

// Pearson correlation: 1 means the two lists rise and fall together. NaN if one list never changes.
export function correlation(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return NaN;
  const meanA = a.slice(0, n).reduce((sum, value) => sum + value, 0) / n;
  const meanB = b.slice(0, n).reduce((sum, value) => sum + value, 0) / n;
  let shared = 0;
  let spreadA = 0;
  let spreadB = 0;
  for (let i = 0; i < n; i++) {
    const deltaA = (a[i] as number) - meanA;
    const deltaB = (b[i] as number) - meanB;
    shared += deltaA * deltaB;
    spreadA += deltaA * deltaA;
    spreadB += deltaB * deltaB;
  }
  return shared / Math.sqrt(spreadA * spreadB);
}
