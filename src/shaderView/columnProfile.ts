// Draws measured GPU time by screen column for Day 560 and for the uniform-cost control. A single
// spike can be ten times its neighbors, so the axis stops short of it. A clipped point is marked and
// labeled with its real value, and the hover readout always shows the exact number.
import { median } from './numbers';

const COLORS = { day: '#9d70e8', control: '#0f9dbd', grid: '#2a3644', ink: '#8b9aab' } as const;
const LEFT = 44;
const RIGHT = 76;

function plotLine(context: CanvasRenderingContext2D, values: readonly number[], x: (i: number) => number, y: (v: number) => number, color: string): void {
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.lineJoin = 'round';
  context.beginPath();
  values.forEach((value, index) => {
    if (index === 0) context.moveTo(x(index), y(value));
    else context.lineTo(x(index), y(value));
  });
  context.stroke();
}

export function axisTop(day: readonly number[]): number {
  return median(day) * 2;
}

export function drawColumnProfile(canvas: HTMLCanvasElement, day: readonly number[], control: readonly number[]): void {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  const top = 16;
  const bottom = height - 18;
  const peak = axisTop(day);
  const x = (index: number) => LEFT + (index / Math.max(1, day.length - 1)) * (width - LEFT - RIGHT);
  const y = (value: number) => bottom - (Math.min(value, peak) / peak) * (bottom - top);

  context.font = '11px ui-monospace, Menlo, monospace';
  context.fillStyle = COLORS.ink;
  context.strokeStyle = COLORS.grid;
  context.lineWidth = 1;
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  for (const tick of [0, peak / 2, peak]) {
    const tickY = Math.round(y(tick)) + 0.5;
    context.beginPath();
    context.moveTo(LEFT, tickY);
    context.lineTo(width - RIGHT, tickY);
    context.stroke();
    context.fillText(tick.toFixed(2), LEFT - 6, tickY);
  }

  plotLine(context, control, x, y, COLORS.control);
  plotLine(context, day, x, y, COLORS.day);

  context.textBaseline = 'alphabetic';
  context.textAlign = 'center';
  // Neighboring spikes would print over each other, so only the first of a group gets a label.
  let lastLabelX = -Infinity;
  day.forEach((value, index) => {
    if (value <= peak || x(index) - lastLabelX < 44) return;
    context.fillText(`${value.toFixed(2)}↑`, x(index), top - 4);
    lastLabelX = x(index);
  });

  context.textBaseline = 'middle';
  context.textAlign = 'left';
  context.fillText('Day 560', width - RIGHT + 6, y(day[day.length - 1] as number));
  context.fillText('Control', width - RIGHT + 6, y(control[control.length - 1] as number));
  context.textBaseline = 'alphabetic';
  context.fillText('screen left', LEFT, height - 3);
  context.textAlign = 'right';
  context.fillText('screen right', width - RIGHT, height - 3);
  context.textAlign = 'left';
  context.fillText('ms', 0, 10);
}

// Which column the pointer is over, using the same horizontal mapping as the chart.
export function columnAt(pointerX: number, width: number, count: number): number {
  const position = (pointerX - LEFT) / (width - LEFT - RIGHT);
  return Math.min(count - 1, Math.max(0, Math.round(position * (count - 1))));
}
