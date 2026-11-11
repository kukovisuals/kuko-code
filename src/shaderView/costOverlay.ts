// Draws the cost map on top of the picture. GPU time is partial, so cells are solid with a hatch.
// March steps are modeled, so cells are wireframe outlines with the picture still visible.
import type { CostMapResult } from './costMap';

export type MapView = 'picture' | 'gpu' | 'control' | 'steps';

// One hue, dark to light, because this shows magnitude.
const RAMP = [
  [14, 45, 58],
  [26, 118, 142],
  [53, 201, 232],
  [205, 243, 251],
] as const;

export function rampColor(position: number): string {
  const clamped = Math.min(1, Math.max(0, position));
  const scaled = clamped * (RAMP.length - 1);
  const index = Math.min(RAMP.length - 2, Math.floor(scaled));
  const blend = scaled - index;
  const from = RAMP[index] as readonly number[];
  const to = RAMP[index + 1] as readonly number[];
  const channel = (i: number) => Math.round((from[i] as number) + ((to[i] as number) - (from[i] as number)) * blend);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

export function rampGradient(): string {
  const stops = RAMP.map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`);
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

function viewValues(result: CostMapResult, view: Exclude<MapView, 'picture'>): number[] {
  if (view === 'gpu') return result.cellMs;
  if (view === 'control') return result.controlCellMs;
  return result.cellSteps;
}

export function overlayRange(result: CostMapResult, view: Exclude<MapView, 'picture'>): [number, number] {
  const values = viewValues(result, view);
  return [Math.min(...values), Math.max(...values)];
}

export function drawCostOverlay(canvas: HTMLCanvasElement, result: CostMapResult | null, view: MapView): void {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  if (!result || view === 'picture') return;

  const values = viewValues(result, view);
  const [low, high] = overlayRange(result, view);
  const spread = high - low || 1;
  const cellWidth = width / result.grid.columns;
  const cellHeight = height / result.grid.rows;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `${Math.max(9, Math.min(11, cellWidth / 5.2))}px ui-monospace, Menlo, monospace`;

  values.forEach((value, index) => {
    const column = index % result.grid.columns;
    const row = Math.floor(index / result.grid.columns);
    const x = column * cellWidth;
    // Grid row 0 is the bottom of the GL buffer but the bottom of the page is the largest y here.
    const y = height - (row + 1) * cellHeight;
    const position = (value - low) / spread;
    const color = rampColor(position);
    if (view !== 'steps') {
      context.fillStyle = color;
      context.fillRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
      context.fillStyle = position > 0.55 ? '#0a0e13' : '#dbe4ee';
      context.fillText(value.toFixed(3), x + cellWidth / 2, y + cellHeight / 2);
    } else {
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(x + 2, y + 2, cellWidth - 4, cellHeight - 4);
      context.fillStyle = 'rgba(10, 14, 19, 0.72)';
      context.fillRect(x + cellWidth / 2 - 14, y + cellHeight / 2 - 8, 28, 16);
      context.fillStyle = '#dbe4ee';
      context.fillText(Math.round(value).toString(), x + cellWidth / 2, y + cellHeight / 2);
    }
  });
}

// Reports which cell the pointer is over, using the same bottom-first order as the data.
export function cellAt(result: CostMapResult, x: number, y: number, width: number, height: number): number {
  const column = Math.min(result.grid.columns - 1, Math.floor((x / width) * result.grid.columns));
  const rowFromTop = Math.min(result.grid.rows - 1, Math.floor((y / height) * result.grid.rows));
  const row = result.grid.rows - 1 - rowFromTop;
  return row * result.grid.columns + column;
}
