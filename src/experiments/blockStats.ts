// Turns one block's per-pixel counts into the numbers the page prints. Pure, so it can be tested without a GPU.
// Counts are measured (counted on the GPU by the counting copy). The SIMD-group numbers are modeled.

// A SIMD group is 32 threads (community source: metal-benchmarks). How those 32 pixels sit on screen isn't
// published, so 8 x 4 is our model.
export const GROUP_WIDTH = 8;
export const GROUP_HEIGHT = 4;
export const GROUP_LANES = GROUP_WIDTH * GROUP_HEIGHT;

export interface GroupGrid {
  columns: number;
  rows: number;
  // Per group, row 0 at the bottom of the screen like gl_FragCoord.
  max: Float32Array;
  mean: Float32Array;
}

export interface BlockStats {
  // Times the block ran this frame, summed over every pixel. Measured.
  total: number;
  // The most times it ran for one pixel. Measured.
  maxPerPixel: number;
  // Pixels where it ran at least once. Measured.
  pixelsRan: number;
  // Modeled: a group goes through the block as many times as its busiest pixel, so it spends
  // 32 x max lane-slots. The share of those slots whose pixel had already stopped.
  waitingShare: number | null;
  groups: GroupGrid;
}

// Counts are laid out like readPixels returns them: rows from the bottom, width pixels per row.
export function blockStats(counts: Uint32Array, width: number, height: number): BlockStats {
  const columns = Math.ceil(width / GROUP_WIDTH);
  const rows = Math.ceil(height / GROUP_HEIGHT);
  const max = new Float32Array(columns * rows);
  const sum = new Float64Array(columns * rows);
  let total = 0;
  let maxPerPixel = 0;
  let pixelsRan = 0;
  for (let y = 0; y < height; y += 1) {
    const groupRow = Math.floor(y / GROUP_HEIGHT) * columns;
    for (let x = 0; x < width; x += 1) {
      const value = counts[y * width + x] as number;
      if (value === 0) continue;
      total += value;
      pixelsRan += 1;
      if (value > maxPerPixel) maxPerPixel = value;
      const group = groupRow + Math.floor(x / GROUP_WIDTH);
      sum[group] = (sum[group] as number) + value;
      if (value > (max[group] as number)) max[group] = value;
    }
  }
  const mean = new Float32Array(columns * rows);
  let slots = 0;
  for (let group = 0; group < mean.length; group += 1) {
    mean[group] = (sum[group] as number) / GROUP_LANES;
    slots += GROUP_LANES * (max[group] as number);
  }
  return {
    total,
    maxPerPixel,
    pixelsRan,
    waitingShare: slots > 0 ? 1 - total / slots : null,
    groups: { columns, rows, max, mean },
  };
}

// Pixels where a loop body ran more often than its constant bound allows. Zero means the counter is sound.
export function overBound(child: Uint32Array, parent: Uint32Array, bound: number): number {
  let over = 0;
  for (let index = 0; index < child.length; index += 1) {
    if ((child[index] as number) > bound * (parent[index] as number)) over += 1;
  }
  return over;
}
