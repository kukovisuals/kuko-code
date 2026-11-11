// Draws the frame budget bar and the recent-frames strip. Both show the same two per-frame series
// on one time axis, with the 60 Hz and 50 Hz budgets marked.
import type { FrameSample } from './liveHistory';

export const BUDGETS = [
  { label: '60 Hz', ms: 1000 / 60 },
  { label: '50 Hz', ms: 20 },
] as const;

const COLORS = { volume: '#0f9dbd', image: '#9d70e8', grid: '#2a3644', ink: '#8b9aab', surface: '#10161e' } as const;

function fitCanvas(canvas: HTMLCanvasElement): { context: CanvasRenderingContext2D; width: number; height: number } {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

function hatch(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.strokeStyle = 'rgba(16, 22, 30, 0.55)';
  context.lineWidth = 1;
  context.beginPath();
  for (let offset = -height; offset < width; offset += 7) {
    context.moveTo(x + offset, y + height);
    context.lineTo(x + offset + height, y);
  }
  context.stroke();
  context.restore();
}

// Partial values are solid with a hatched band, per the project's honesty rules.
export function drawBudgetBar(canvas: HTMLCanvasElement, volumeMs: number, imageMs: number): void {
  const { context, width, height } = fitCanvas(canvas);
  const total = (Number.isFinite(volumeMs) ? volumeMs : 0) + (Number.isFinite(imageMs) ? imageMs : 0);
  const scale = (width - 2) / Math.max(24, total * 1.08);
  const barTop = 18;
  const barHeight = height - 26;
  context.font = '11px ui-monospace, Menlo, monospace';

  let x = 0;
  for (const [value, color] of [[volumeMs, COLORS.volume], [imageMs, COLORS.image]] as const) {
    if (!Number.isFinite(value)) continue;
    const segment = Math.max(0, value * scale - 2);
    context.fillStyle = color;
    context.fillRect(x, barTop, segment, barHeight);
    hatch(context, x, barTop + barHeight * 0.55, segment, barHeight * 0.45);
    x += value * scale;
  }

  context.fillStyle = COLORS.ink;
  context.strokeStyle = COLORS.ink;
  for (const budget of BUDGETS) {
    const markX = Math.round(budget.ms * scale) + 0.5;
    context.beginPath();
    context.moveTo(markX, 14);
    context.lineTo(markX, height - 4);
    context.stroke();
    const label = `${budget.label} ${budget.ms.toFixed(2)} ms`;
    const align = budget.ms < 18 ? 'right' : 'left';
    context.textAlign = align;
    context.fillText(label, markX + (align === 'right' ? -4 : 4), 11);
  }
}

// Stacks the two passes for each frame, newest on the right.
export function drawFrameStrip(canvas: HTMLCanvasElement, samples: readonly FrameSample[], capacity: number): void {
  const { context, width: fullWidth, height } = fitCanvas(canvas);
  // The budget labels sit in a gutter on the right, so bars never run through them.
  const gutter = 44;
  const width = fullWidth - gutter;
  const top = 4;
  const bottom = height - 16;
  const peak = samples.reduce((max, sample) => Math.max(max, (sample.volume ?? 0) + (sample.image ?? 0)), 24);
  const scale = (bottom - top) / (peak * 1.05);
  const columnWidth = width / capacity;
  context.font = '11px ui-monospace, Menlo, monospace';

  samples.forEach((sample, index) => {
    const x = width - (samples.length - index) * columnWidth;
    const volumeHeight = (sample.volume ?? 0) * scale;
    const imageHeight = (sample.image ?? 0) * scale;
    const barWidth = Math.max(1, columnWidth - 0.5);
    context.fillStyle = COLORS.volume;
    context.fillRect(x, bottom - volumeHeight, barWidth, volumeHeight);
    context.fillStyle = COLORS.image;
    context.fillRect(x, bottom - volumeHeight - imageHeight, barWidth, imageHeight);
  });

  context.strokeStyle = COLORS.ink;
  context.fillStyle = COLORS.ink;
  context.textAlign = 'left';
  for (const budget of BUDGETS) {
    const y = Math.round(bottom - budget.ms * scale) + 0.5;
    context.setLineDash([3, 3]);
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
    context.setLineDash([]);
    context.fillText(budget.label, width + 4, budget.ms < 18 ? y + 9 : y - 1);
  }

  context.strokeStyle = COLORS.grid;
  context.beginPath();
  context.moveTo(0, bottom + 0.5);
  context.lineTo(width, bottom + 0.5);
  context.stroke();
  context.fillStyle = COLORS.ink;
  context.fillText(`${capacity} frames ago`, 0, height - 3);
  context.textAlign = 'right';
  context.fillText('now', width, height - 3);
}
