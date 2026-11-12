// Pure: the few numbers that say whether a frame fits its budget, picked from a live recording.
// Every row keeps the status and source of the metric it came from. Anything calculated here is modeled.
import { frameBudget } from '../gpuFill';
import type { SourcedNumber } from '../stopRows';
import type { Metric, Recording } from '../../shared/types';

function find(recording: Recording, stop: number, id: string): Metric | null {
  return recording.stops.find((entry) => entry.stop === stop)?.metrics.find((entry) => entry.id === id) ?? null;
}

const oneDecimal = (value: number) => Math.round(value * 10) / 10;

function fromMetric(name: string, metric: Metric | null, pick: 'value' | 'p95' = 'value'): SourcedNumber {
  if (!metric) {
    return { name, value: null, unit: 'ms', tag: 'no reading', source: 'The live program has not reported this yet.' };
  }
  const value = pick === 'p95' ? (metric.stats?.p95 ?? null) : metric.value;
  const window = metric.stats ? ` Over the last ${metric.stats.n} frames.` : '';
  return { name, value, unit: metric.unit, tag: metric.status, source: `${metric.id}: ${metric.source}.${window}` };
}

// A native reading for the same thing, when a trace has been imported. It gets its own row, marked native.
function nativeRows(recording: Recording, stop: number, id: string, name: string): SourcedNumber[] {
  return recording.imports
    .filter((entry) => entry.stop === stop)
    .flatMap((entry) => entry.metrics.filter((metric) => metric.id === id))
    .map((metric) => {
      const count = metric.stats ? ` Over ${metric.stats.n} readings.` : '';
      const caveat = metric.note ? ` ${metric.note}` : '';
      return { name, value: metric.value, unit: metric.unit, tag: metric.status, source: `${metric.id}: ${metric.source}.${count}${caveat}`, native: true };
    });
}

export function frameSummary(recording: Recording): SourcedNumber[] {
  const gpu = find(recording, 6, 'gpuMs');
  const budget = frameBudget(recording);
  const gpuMs = gpu?.value ?? null;
  const budgetSource = budget ? `Stop 6 median gpuMs against the ${budget.budgetMs.toFixed(2)} ms frame budget (${budget.source}). Calculated, so modeled.` : 'No frame budget for this display.';
  const share = gpuMs !== null && budget ? oneDecimal((gpuMs / budget.budgetMs) * 100) : null;
  const headroom = gpuMs !== null && budget ? budget.budgetMs - gpuMs : null;

  // The one-shot cost of getting the shader ready: the hitch a user feels once, not every frame.
  const buildParts = [find(recording, 4, 'compileMs'), find(recording, 5, 'linkMs'), find(recording, 5, 'firstDrawMs')];
  const buildValues = buildParts.map((part) => part?.value ?? null);
  const build = buildValues.every((value): value is number => value !== null) ? buildValues.reduce((a, b) => a + b, 0) : null;

  return [
    fromMetric('GPU time per frame, median', gpu),
    fromMetric('GPU time per frame, p95', gpu, 'p95'),
    ...nativeRows(recording, 6, 'nativeFragmentMs', 'GPU time per frame, Instruments (city closed)'),
    { name: 'Share of frame budget', value: share, unit: '%', tag: 'modeled', source: budgetSource },
    { name: 'Headroom per frame', value: headroom, unit: 'ms', tag: 'modeled', source: budgetSource },
    fromMetric('Frame interval, median', find(recording, 8, 'frameDeltaMs')),
    fromMetric('Frame interval, p95', find(recording, 8, 'frameDeltaMs'), 'p95'),
    fromMetric('JS calls per frame', find(recording, 2, 'frameCallsMs')),
    {
      name: 'Build, once: compile + link + first draw',
      value: build,
      unit: 'ms',
      tag: 'partial',
      source: 'Sum of compileMs (stop 4), linkMs and firstDrawMs (stop 5). Each is partial: it includes the call overhead of stops 2 and 3.',
    },
    ...nativeRows(recording, 5, 'nativeFragmentCompileMs', 'Metal fragment compile, Instruments'),
  ];
}
