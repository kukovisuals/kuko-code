import { describe, expect, it } from 'vitest';
import { summarize } from '../src/record/summarize';

describe('summarize', () => {
  it('returns null for no readings', () => {
    expect(summarize([])).toBeNull();
  });

  it('gives one reading as every stat', () => {
    expect(summarize([2.5])).toEqual({ n: 1, min: 2.5, median: 2.5, p95: 2.5, max: 2.5 });
  });

  it('sorts first, so input order does not matter', () => {
    expect(summarize([3, 1, 2])).toEqual({ n: 3, min: 1, median: 2, p95: 3, max: 3 });
  });

  it('averages the two middle readings when n is even', () => {
    expect(summarize([4, 1, 3, 2])?.median).toBe(2.5);
  });

  it('uses nearest rank for p95, so it is always a real reading', () => {
    // 1 to 20: 95% of 20 is 19, so the 19th smallest.
    const oneToTwenty = Array.from({ length: 20 }, (_, index) => index + 1);
    expect(summarize(oneToTwenty)?.p95).toBe(19);
    // 1 to 10: 95% of 10 is 9.5, rounded up to the 10th.
    const oneToTen = Array.from({ length: 10 }, (_, index) => index + 1);
    expect(summarize(oneToTen)?.p95).toBe(10);
  });

  it('keeps one slow outlier visible in max and out of the median', () => {
    const stats = summarize([1, 1, 1, 1, 50]);
    expect(stats?.median).toBe(1);
    expect(stats?.max).toBe(50);
  });

  it('does not change the input array', () => {
    const readings = [3, 1, 2];
    summarize(readings);
    expect(readings).toEqual([3, 1, 2]);
  });

  it('refuses a reading that is not a finite number', () => {
    expect(() => summarize([1, Number.NaN])).toThrow();
    expect(() => summarize([1, Number.POSITIVE_INFINITY])).toThrow();
  });
});
