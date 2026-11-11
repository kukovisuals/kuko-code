// Pure layout: block ids in, positions and sizes out. No Three.js, so it runs in tests without a GPU.
// World units are arbitrary and the arrangement is schematic. It follows the map in backlog R2.

export interface Rect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface PlacedBlock extends Rect {
  id: string;
  // The block this one is drawn inside. Overlap with it is intended.
  within?: string;
}

const SLOTS: Record<string, Rect & { within?: string }> = {
  wifi: { x: -42, z: -28.5, w: 16, d: 4 },
  'dev-server': { x: 16, z: -28.5, w: 16, d: 4 },
  ssd: { x: 36, z: -28.5, w: 12, d: 4 },
  'network-road': { x: -38, z: -23, w: 76, d: 3.5 },
  'memory-ring': { x: -46, z: -18, w: 92, d: 39 },
  cpu: { x: -43, z: -15, w: 42, d: 16, within: 'memory-ring' },
  'p-cluster': { x: -42, z: -14.5, w: 18, d: 3.5, within: 'cpu' },
  'e-cluster': { x: -21, z: -14.5, w: 18, d: 3.5, within: 'cpu' },
  gpu: { x: 1, z: -15, w: 42, d: 16, within: 'memory-ring' },
  'gpu-core': { x: 2, z: -9, w: 40, d: 8.5, within: 'gpu' },
  slc: { x: -43, z: 2.5, w: 86, d: 3, within: 'memory-ring' },
  'neural-engine': { x: -43, z: 6.5, w: 16, d: 11.5, within: 'memory-ring' },
  'media-engine': { x: -26, z: 6.5, w: 16, d: 11.5, within: 'memory-ring' },
  'display-engines': { x: -9, z: 6.5, w: 52, d: 11.5, within: 'memory-ring' },
  dcp: { x: -6, z: 13.5, w: 12, d: 3.5, within: 'display-engines' },
  dcpext: { x: 14, z: 13.5, w: 12, d: 3.5, within: 'display-engines' },
  'exit-built-in': { x: -8, z: 23, w: 16, d: 6 },
  'exit-lg': { x: 12, z: 23, w: 16, d: 6 },
};

// A new block must get a slot here, so it can't silently vanish from the map.
export function layoutMap(blockIds: string[]): PlacedBlock[] {
  return blockIds.map((id) => {
    const slot = SLOTS[id];
    if (!slot) {
      throw new Error(`layoutMap has no slot for block "${id}"`);
    }
    return { id, ...slot };
  });
}

// Divides the gpu-core area into a 2-row grid, one cell per core.
export function layoutGpuCores(area: Rect, coreCount: number, gap = 0.5): Rect[] {
  const columns = Math.ceil(coreCount / 2);
  const w = (area.w - gap * (columns + 1)) / columns;
  const d = (area.d - gap * 3) / 2;
  return Array.from({ length: coreCount }, (_, index) => ({
    x: area.x + gap + (index % columns) * (w + gap),
    z: area.z + gap + Math.floor(index / columns) * (d + gap),
    w,
    d,
  }));
}

// Divides a CPU cluster into one row of tiles, one per core.
export function layoutCpuCores(area: Rect, coreCount: number, gap = 0.4): Rect[] {
  const w = (area.w - gap * (coreCount + 1)) / coreCount;
  return Array.from({ length: coreCount }, (_, index) => ({
    x: area.x + gap + index * (w + gap),
    z: area.z + gap,
    w,
    d: area.d - gap * 2,
  }));
}

// Where each stop stands. Stops 2 and 3 share one site because they are one building.
const STOP_SITES: Record<number, Rect> = {
  1: { x: -24.5, z: -23, w: 4, d: 3.5 },
  2: { x: -42, z: -7, w: 8, d: 6 },
  3: { x: -42, z: -7, w: 8, d: 6 },
  4: { x: -22, z: -7, w: 6, d: 6 },
  5: { x: -10, z: -7, w: 6, d: 6 },
  6: { x: 7, z: -14.5, w: 6, d: 4.5 },
  7: { x: 31.5, z: -14.5, w: 5, d: 4.5 },
  8: { x: 5, z: 7, w: 14, d: 5.5 },
};

export function siteForStop(stop: number): Rect {
  const site = STOP_SITES[stop];
  if (!site) {
    throw new Error(`No site for stop ${stop}`);
  }
  return site;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.z >= outer.z &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.z + inner.d <= outer.z + outer.d
  );
}
