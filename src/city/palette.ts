// Scene colors. One-shot and per-frame colors must stay different, per the honesty rules.
export const COLORS = {
  background: '#0a0e13',
  oneShot: '#f2a33a',
  perFrame: '#35c9e8',
  wifiDim: '#6b7888',
  ghost: '#7d8a99',
  outline: '#55657a',
  pCore: '#ffd27a',
  eCore: '#9be28f',
} as const;

export const BLOCK_COLORS: Record<string, string> = {
  'memory-ring': '#3a4a60',
  cpu: '#1b2a40',
  'p-cluster': '#2b4265',
  'e-cluster': '#2b4265',
  gpu: '#241f3d',
  'gpu-core': '#2c2650',
  slc: '#20343a',
  'neural-engine': '#171b22',
  'media-engine': '#171b22',
  'display-engines': '#14302d',
  dcp: '#1f4a44',
  dcpext: '#1f4a44',
  wifi: '#15181d',
  'dev-server': '#1d3040',
  'network-road': '#161e28',
  'exit-built-in': '#1a2129',
  'exit-lg': '#1a2129',
};

// Top surface height for each block, in world units.
export const BLOCK_HEIGHTS: Record<string, number> = {
  'memory-ring': 0.45,
  cpu: 0.2,
  gpu: 0.2,
  'display-engines': 0.2,
  'neural-engine': 0.2,
  'media-engine': 0.2,
  slc: 0.3,
  'gpu-core': 0.26,
  'p-cluster': 0.35,
  'e-cluster': 0.35,
  dcp: 0.35,
  dcpext: 0.35,
  'network-road': 0.12,
  wifi: 0.3,
  'dev-server': 0.3,
  'exit-built-in': 0.3,
  'exit-lg': 0.3,
};

// Roads run above everything flat, so they stay readable where they cross the ring.
export const ROAD_Y = 0.5;
export const CHIP_FLOOR_Y = 0.08;
