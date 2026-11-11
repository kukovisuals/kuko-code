// The saved result of the experiments page: how each block of Day 442 ran on the GPU, GPU time by screen tile,
// and the translated source. The page writes it and the city may read it, so the shape lives here, where both
// can import it without the city importing measuring code. It holds readings only, never a suggestion.
import type { Environment } from './types';

export const EXPERIMENT_SCHEMA = 'day442-hardware/1';
export const EXPERIMENT_SAVE_PATH = '/__experiments/day442';
export const EXPERIMENT_FILE = 'data/experiments/day442.json';

export interface Spread {
  median: number;
  min: number;
  max: number;
  samples: number;
}

export interface BlockResult {
  id: string;
  file: string;
  kind: string;
  functionName: string;
  startLine: number;
  endLine: number;
  header: string;
  // Measured: counted on the GPU by the counting copy, read back with readPixels.
  total: number;
  maxPerPixel: number;
  pixelsRan: number;
  // Modeled: share of SIMD-group lane-slots spent waiting, with 32-pixel groups laid out as 8 x 4.
  waitingShare: number | null;
  // A loop's constant bound per run of its parent block, and how many pixels broke it (0 when sound).
  maxPerParent: number | null;
  overBoundPixels: number | null;
}

export interface TileResult {
  column: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  // Partial: TIME_ELAPSED_EXT around one scissored draw, a time range including the draw's fixed cost.
  ms: Spread | null;
  emptyMs: Spread | null;
}

export interface Check {
  passed: boolean;
  text: string;
}

export interface ExperimentResult {
  schema: typeof EXPERIMENT_SCHEMA;
  savedAt: string;
  program: string;
  width: number;
  height: number;
  // Every draw on the page uses this iTime, so counts and times describe the same picture.
  sceneTimeS: number;
  sources: { counts: string; simd: string; tiles: string; translated: string };
  counting: { passes: number; outputsPerPass: number; blocks: BlockResult[] };
  tiles: {
    size: number;
    columns: number;
    rows: number;
    warmupRounds: number;
    timedRounds: number;
    seed: number;
    items: TileResult[];
    // The real shader over the whole screen in one draw, timed in the same rounds.
    wholeFrameMs: Spread | null;
  };
  translated: {
    available: boolean;
    language: string | null;
    // The full fragment shader as compiled: wrapper, Common and Image.
    glsl: { bytes: number; lines: number };
    text: string | null;
  };
  environment: Environment;
  crossOriginIsolated: boolean;
  disjointReads: number;
  neverReturned: number;
  hiddenDuringRun: boolean;
  runSeconds: number;
  checks: Check[];
}
