// Scene colors. One-shot and per-frame colors must stay different, per the honesty rules.
export const COLORS = {
  background: '#07090c',
  // Illustrative material colors for the parts that carry no data.
  board: '#10161a',
  substrate: '#1d2a26',
  dieFloor: '#2b303a',
  gpuPad: '#4f73a8',
  capacitor: '#a58258',
  solder: '#9aa0a6',
  chipPackage: '#1a1c1f',
  shieldCan: '#6f767e',
  oneShot: '#f2a33a',
  perFrame: '#35c9e8',
  wifiDim: '#6b7888',
  ghost: '#7d8a99',
  outline: '#55657a',
  pCore: '#ffd27a',
  eCore: '#9be28f',
  process: '#8fb4ff',
} as const;

// Illustrative, not measured. Die blocks borrow the blue-violet to pink to gold tints of Apple's M2
// artwork, kept muted so the one-shot and per-frame colors stay the brightest things on the map.
export const BLOCK_COLORS: Record<string, string> = {
  // Drawn as the gold stiffener frame of the package.
  'memory-ring': '#c49a4c',
  cpu: '#3a4170',
  'p-cluster': '#565f9a',
  'e-cluster': '#565f9a',
  gpu: '#2f4c7c',
  'gpu-core': '#3b5d94',
  slc: '#6f7686',
  'neural-engine': '#74476a',
  'media-engine': '#86584c',
  'display-engines': '#7d6830',
  dcp: '#a58a44',
  dcpext: '#a58a44',
  // Off-chip parts: a shielded radio can, black chip packages and bare board.
  wifi: '#5d646c',
  'dev-server': '#1c2630',
  ssd: '#1a1c1f',
  'network-road': '#17282a',
  'exit-built-in': '#22262b',
  'exit-lg': '#22262b',
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
  ssd: 0.3,
  'exit-built-in': 0.3,
  'exit-lg': 0.3,
};

// Roads run above everything flat, so they stay readable where they cross the ring.
export const ROAD_Y = 0.5;
export const CHIP_FLOOR_Y = 0.08;

// Blocks whose top shows the fine cell pattern of the die.
export const DIE_BLOCKS = ['cpu', 'gpu', 'slc', 'neural-engine', 'media-engine', 'display-engines'];
// The logic board's top sits just under the blocks, so no two faces share a plane.
export const BOARD_Y = -0.02;
