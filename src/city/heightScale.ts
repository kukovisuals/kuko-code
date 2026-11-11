// Pure ms-to-height math. Log scale, because times here span several orders of magnitude.

export const HEIGHT_PER_DECADE = 3;
export const REFERENCE_MS = 0.01;

// Adding 1 keeps the result at 0 for 0 ms and positive for any time above that.
export function heightFromMs(ms: number): number {
  return HEIGHT_PER_DECADE * Math.log10(1 + ms / REFERENCE_MS);
}

export interface FloorSplit {
  totalMs: number;
  totalHeight: number;
  floorHeights: number[];
}

// Height comes from the sum, then floors share it by their ms.
// Stacking separately scaled floors would misstate the total.
export function splitFloors(floorsMs: number[]): FloorSplit {
  const totalMs = floorsMs.reduce((sum, ms) => sum + ms, 0);
  const totalHeight = heightFromMs(totalMs);
  const floorHeights = floorsMs.map((ms) => (totalMs > 0 ? totalHeight * (ms / totalMs) : 0));
  return { totalMs, totalHeight, floorHeights };
}
