// Times the real, unchanged shader one screen tile at a time: a scissor limits the draw to the tile, and a
// TIME_ELAPSED_EXT query wraps it. An empty shader is timed in the same tile, so a draw's fixed cost is measured
// too. One round per animation frame, tiles in a seeded shuffled order each round. Partial: a time range per
// draw, which includes that fixed cost.
import type { TimerQueryExt } from '../record/probeEnvironment';
import { PassTimer } from '../shaderView/passTimer';
import type { GlProgram } from './glProgram';
import { seededRandom, shuffled } from './spread';

export const TILE_SIZE = 80;
export const WARMUP_ROUNDS = 2;
export const TIMED_ROUNDS = 12;
// Polling stops this many frames after the last round, and anything still out counts as never returned.
const DRAIN_FRAMES = 120;

export interface Tile {
  index: number;
  column: number;
  // Row 0 at the bottom, like gl_FragCoord and the scissor.
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function tileGrid(width: number, height: number, size: number): { columns: number; rows: number; tiles: Tile[] } {
  const columns = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  const tiles: Tile[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column * size;
      const y = row * size;
      tiles.push({ index: tiles.length, column, row, x, y, width: Math.min(size, width - x), height: Math.min(size, height - y) });
    }
  }
  return { columns, rows, tiles };
}

interface Tag {
  kind: 'tile' | 'empty' | 'whole';
  tile: number;
  warmup: boolean;
}

export interface TileRun {
  // Per tile, one GPU time per timed round, for the real shader and for the empty one.
  tileMs: number[][];
  emptyMs: number[][];
  // The real shader over the whole screen, one draw per round with no scissor.
  wholeMs: number[];
  disjointReads: number;
  neverReturned: number;
  hiddenDuringRun: boolean;
  runSeconds: number;
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

export async function runTileTimings(
  gl: WebGL2RenderingContext,
  ext: TimerQueryExt,
  real: GlProgram,
  empty: GlProgram,
  tiles: Tile[],
  time: number,
  seed: number,
  onProgress: (round: number, rounds: number) => void,
): Promise<TileRun> {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  const tileMs: number[][] = tiles.map(() => []);
  const emptyMs: number[][] = tiles.map(() => []);
  const wholeMs: number[] = [];
  let disjointReads = 0;
  let hiddenDuringRun = false;
  const random = seededRandom(seed);
  const timer = new PassTimer<Tag>(gl, ext, (tag, ms) => {
    if (tag.warmup) return;
    if (tag.kind === 'whole') wholeMs.push(ms);
    else (tag.kind === 'tile' ? tileMs : emptyMs)[tag.tile]?.push(ms);
  });
  // A disjoint read means the GPU's timer was interrupted, so results since the last check can't be trusted.
  const poll = () => {
    if (gl.getParameter(ext.GPU_DISJOINT_EXT)) disjointReads += 1;
    timer.poll();
  };
  const startedAt = performance.now();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, width, height);
  const rounds = WARMUP_ROUNDS + TIMED_ROUNDS;
  for (let round = 0; round < rounds; round += 1) {
    await nextFrame();
    if (document.hidden) hiddenDuringRun = true;
    poll();
    const warmup = round < WARMUP_ROUNDS;
    gl.disable(gl.SCISSOR_TEST);
    timer.timed({ kind: 'whole', tile: -1, warmup }, () => real.draw(time, width, height));
    gl.enable(gl.SCISSOR_TEST);
    for (const tile of shuffled(tiles, random)) {
      gl.scissor(tile.x, tile.y, tile.width, tile.height);
      timer.timed({ kind: 'tile', tile: tile.index, warmup }, () => real.draw(time, width, height));
      timer.timed({ kind: 'empty', tile: tile.index, warmup }, () => empty.draw(time, width, height));
    }
    gl.disable(gl.SCISSOR_TEST);
    onProgress(round + 1, rounds);
  }
  for (let extra = 0; extra < DRAIN_FRAMES && timer.pendingCount > 0; extra += 1) {
    await nextFrame();
    poll();
  }
  return {
    tileMs,
    emptyMs,
    wholeMs,
    disjointReads,
    neverReturned: timer.pendingCount,
    hiddenDuringRun,
    runSeconds: (performance.now() - startedAt) / 1000,
  };
}
