// Times parts of the screen with the scissor and the GPU timer, for Day 560's Image pass and for a
// control shader that costs the same at every pixel. The volume stays frozen, so every round draws
// the same picture. Grid cells are regions of the screen, not the GPU's real tiles or cores.
import type { TimerQueryExt } from '../record/probeEnvironment';
import { BUFFER, type DayRenderer, type FrameInputs } from './dayRenderer';
import { correlation, median, rankCorrelation } from './numbers';
import { PassTimer } from './passTimer';
import { stepsPerCell, type GridSize } from './workload';

export const GRID: GridSize = { columns: 16, rows: 10 };
const COLUMN_GRID: GridSize = { columns: 32, rows: 1 };
const ROUNDS = 12;
const FLOOR_SAMPLES = 16;

type Region = readonly [number, number, number, number];

export interface CostMapResult {
  grid: GridSize;
  rounds: number;
  // Median GPU ms per cell, bottom row first.
  cellMs: number[];
  controlCellMs: number[];
  // Modeled average march steps per pixel, in the same order.
  cellSteps: number[];
  // Full-height columns, left to right.
  columnMs: number[];
  controlColumnMs: number[];
  sumOfCellsMs: number;
  fullFrameMs: number;
  // A 1-pixel draw: the most a nearly empty draw costs under the same conditions.
  floorMs: number;
  // Do the shader and the control share a left-right pattern? High means it isn't the shader's own.
  stripeCorrelation: number;
  // Do measured columns rise with modeled march steps? The control shows what no link looks like.
  columnStepsCorrelation: number;
  controlColumnStepsCorrelation: number;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function shuffled(count: number): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  return order;
}

export function gridRegions(grid: GridSize, width: number, height: number): Region[] {
  const regions: Region[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      const x = Math.floor((column * width) / grid.columns);
      const y = Math.floor((row * height) / grid.rows);
      const endX = Math.floor(((column + 1) * width) / grid.columns);
      const endY = Math.floor(((row + 1) * height) / grid.rows);
      regions.push([x, y, endX - x, endY - y]);
    }
  }
  return regions;
}

// The median of each grid column. It keeps a left-right pattern and ignores the occasional region
// that spikes to several times its neighbors, which an average would let dominate.
export function columnMedians(cells: readonly number[], grid: GridSize): number[] {
  return Array.from({ length: grid.columns }, (_, column) => {
    const values = Array.from({ length: grid.rows }, (_, row) => cells[row * grid.columns + column] as number);
    return median(values);
  });
}

function floorRegions(count: number, width: number, height: number): Region[] {
  return Array.from({ length: count }, (_, i) => [Math.floor(((i + 0.5) * width) / count), Math.floor(height / 2), 1, 1] as const);
}

class RegionTimer {
  private syncPixel = new Uint8Array(4);

  constructor(
    private gl: WebGL2RenderingContext,
    private ext: TimerQueryExt,
  ) {}

  // Without the readPixels, 160 draws each reported about the whole batch's time and added up to
  // 102x the whole pass. Reading a pixel makes each draw finish before the next one starts.
  async medians(regions: readonly Region[], draw: () => void, rounds: number): Promise<number[]> {
    const { gl } = this;
    const samples: number[][] = regions.map(() => []);
    const timer = new PassTimer<number>(gl, this.ext, (index, ms) => (samples[index] as number[]).push(ms));
    gl.enable(gl.SCISSOR_TEST);
    for (let round = 0; round < rounds; round++) {
      await nextFrame();
      // A new random order each round, so no region always runs first or last.
      for (const index of shuffled(regions.length)) {
        gl.scissor(...(regions[index] as Region));
        timer.timed(index, draw);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.syncPixel);
      }
      while (timer.pendingCount > 0) {
        await nextFrame();
        timer.poll();
      }
    }
    gl.disable(gl.SCISSOR_TEST);
    return samples.map((values) => median(values));
  }
}

export async function runCostMap(
  gl: WebGL2RenderingContext,
  ext: TimerQueryExt,
  renderer: DayRenderer,
  inputs: FrameInputs,
  onProgress: (step: string) => void,
): Promise<CostMapResult> {
  const { width, height } = BUFFER;
  const regionTimer = new RegionTimer(gl, ext);
  const cells = gridRegions(GRID, width, height);
  const columns = gridRegions(COLUMN_GRID, width, height);
  const draw = () => renderer.drawImage();

  onProgress('Day 560: whole pass and floor');
  renderer.prepareImage(inputs);
  const [fullFrameMs] = await regionTimer.medians([[0, 0, width, height]], draw, ROUNDS);
  const floorMs = median(await regionTimer.medians(floorRegions(FLOOR_SAMPLES, width, height), draw, ROUNDS));
  onProgress('Day 560: regions');
  const cellMs = await regionTimer.medians(cells, draw, ROUNDS);
  onProgress('Day 560: columns');
  const columnMs = await regionTimer.medians(columns, draw, ROUNDS);

  onProgress('Control shader: regions and columns');
  renderer.prepareControl(inputs);
  const controlCellMs = await regionTimer.medians(cells, draw, ROUNDS);
  const controlColumnMs = await regionTimer.medians(columns, draw, ROUNDS);

  // Leave Day 560's picture on the canvas, because that is what the map is drawn over.
  await nextFrame();
  renderer.prepareImage(inputs);
  renderer.drawImage();

  const columnSteps = stepsPerCell(width, height, COLUMN_GRID, inputs.mouse);
  return {
    grid: GRID,
    rounds: ROUNDS,
    cellMs,
    controlCellMs,
    cellSteps: stepsPerCell(width, height, GRID, inputs.mouse),
    columnMs,
    controlColumnMs,
    sumOfCellsMs: cellMs.reduce((sum, value) => sum + value, 0),
    fullFrameMs: fullFrameMs as number,
    floorMs,
    stripeCorrelation: correlation(columnMedians(cellMs, GRID), columnMedians(controlCellMs, GRID)),
    columnStepsCorrelation: rankCorrelation(columnMs, columnSteps),
    controlColumnStepsCorrelation: rankCorrelation(controlColumnMs, columnSteps),
  };
}
