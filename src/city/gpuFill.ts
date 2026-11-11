// Pure share-of-frame calculation for the GPU district. The result is always modeled.
import type { Recording } from '../shared/types';

export interface FrameBudget {
  budgetMs: number;
  source: string;
}

export interface GpuFill extends FrameBudget {
  gpuMs: number;
  // Clamped to 0..1 for drawing.
  fill: number;
  // Unclamped, so an over-budget shader stays visible.
  percent: number;
}

const EXIT_BLOCKS = { 'built-in': 'exit-built-in', lg: 'exit-lg' } as const;

function metricValue(recording: Recording, stop: number, id: string): number | null {
  const metric = recording.stops.find((entry) => entry.stop === stop)?.metrics.find((entry) => entry.id === id);
  return metric?.value ?? null;
}

export function frameBudget(recording: Recording): FrameBudget | null {
  const { display } = recording.capture;
  if (display === 'unknown') {
    const cadence = metricValue(recording, 8, 'frameDeltaMs');
    return cadence === null ? null : { budgetMs: cadence, source: 'Stop 8 frameDeltaMs from this recording' };
  }
  const exit = recording.hardwareMap.blocks.find((block) => block.id === EXIT_BLOCKS[display]);
  const budget = exit?.numbers.find((number) => number.name === 'Frame budget');
  return budget ? { budgetMs: budget.value, source: budget.source } : null;
}

export function gpuFill(recording: Recording): GpuFill | null {
  const gpuMs = metricValue(recording, 6, 'gpuMs');
  const budget = frameBudget(recording);
  if (gpuMs === null || budget === null) {
    return null;
  }
  const share = gpuMs / budget.budgetMs;
  return { ...budget, gpuMs, fill: Math.min(share, 1), percent: share * 100 };
}
