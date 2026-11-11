// Draws a grid of values as a heatmap on a 2D canvas, and finds which cell the pointer is over. The grids
// come from the GPU with row 0 at the bottom, so drawing flips them to match the picture.

// One hue from dark to bright, so more always reads as brighter. Zero stays the panel color.
const RAMP: [number, number, number][] = [
  [24, 38, 56],
  [36, 110, 140],
  [120, 190, 160],
  [245, 214, 110],
];

function rampColor(share: number): [number, number, number] {
  const scaled = Math.min(Math.max(share, 0), 1) * (RAMP.length - 1);
  const low = Math.floor(scaled);
  const high = Math.min(low + 1, RAMP.length - 1);
  const mix = scaled - low;
  const a = RAMP[low] as [number, number, number];
  const b = RAMP[high] as [number, number, number];
  return [0, 1, 2].map((channel) => Math.round((a[channel] as number) + ((b[channel] as number) - (a[channel] as number)) * mix)) as [number, number, number];
}

export function drawHeatmap(canvas: HTMLCanvasElement, values: ArrayLike<number>, columns: number, rows: number, low: number, high: number): void {
  canvas.width = columns;
  canvas.height = rows;
  const context = canvas.getContext('2d');
  if (!context) return;
  const image = context.createImageData(columns, rows);
  const span = high - low || 1;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const value = values[row * columns + column] as number;
      const [r, g, b] = value > 0 ? rampColor((value - low) / span) : [16, 22, 30];
      const at = ((rows - 1 - row) * columns + column) * 4;
      image.data[at] = r;
      image.data[at + 1] = g;
      image.data[at + 2] = b;
      image.data[at + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

export function legendGradient(): string {
  return `linear-gradient(90deg, ${RAMP.map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`).join(', ')})`;
}

// The cell under the pointer, with row 0 at the bottom like the data.
export function cellAt(canvas: HTMLCanvasElement, event: MouseEvent, columns: number, rows: number): { column: number; row: number } {
  const box = canvas.getBoundingClientRect();
  const column = Math.min(columns - 1, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * columns)));
  const fromTop = Math.min(rows - 1, Math.max(0, Math.floor(((event.clientY - box.top) / box.height) * rows)));
  return { column, row: rows - 1 - fromTop };
}
