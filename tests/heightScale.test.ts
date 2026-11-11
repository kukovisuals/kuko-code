import { describe, expect, it } from 'vitest';
import { HEIGHT_PER_DECADE, heightFromMs, splitFloors } from '../src/city/heightScale';

describe('heightFromMs', () => {
  it('is 0 at 0 ms and rises with time', () => {
    expect(heightFromMs(0)).toBe(0);
    expect(heightFromMs(1)).toBeGreaterThan(heightFromMs(0.1));
    expect(heightFromMs(100)).toBeGreaterThan(heightFromMs(1));
  });

  it('adds about one decade of height per tenfold time', () => {
    expect(heightFromMs(100) - heightFromMs(10)).toBeCloseTo(HEIGHT_PER_DECADE, 2);
  });
});

describe('splitFloors', () => {
  it('sizes the building from the sum, not from each floor', () => {
    const { totalHeight, floorHeights } = splitFloors([20, 40]);
    expect(totalHeight).toBeCloseTo(heightFromMs(60));
    expect(floorHeights[0] + floorHeights[1]).toBeCloseTo(totalHeight);
    expect(totalHeight).toBeLessThan(heightFromMs(20) + heightFromMs(40));
  });

  it('divides height in proportion to ms', () => {
    const { floorHeights } = splitFloors([20, 40]);
    expect(floorHeights[1] / floorHeights[0]).toBeCloseTo(2);
  });

  it('handles all-zero floors without dividing by zero', () => {
    expect(splitFloors([0, 0]).floorHeights).toEqual([0, 0]);
  });
});
