import { describe, expect, it } from 'vitest';
import { frameBudget, gpuFill } from '../src/city/gpuFill';
import { buildPlaceholderRecording } from '../src/city/placeholderRecording';
import type { Recording } from '../src/shared/types';

function withGpuMs(recording: Recording, value: number | null): Recording {
  const copy = structuredClone(recording);
  copy.stops.find((stop) => stop.stop === 6)!.metrics.find((metric) => metric.id === 'gpuMs')!.value = value;
  return copy;
}

describe('gpuFill', () => {
  it('matches the backlog example: 8 ms is 48% at 60 Hz and 40% at 50 Hz', () => {
    const builtIn = gpuFill(withGpuMs(buildPlaceholderRecording('built-in'), 8))!;
    const lg = gpuFill(withGpuMs(buildPlaceholderRecording('lg'), 8))!;
    expect(builtIn.percent).toBeCloseTo(48, 0);
    expect(lg.percent).toBeCloseTo(40, 5);
  });

  it('clamps the fill but keeps the over-budget percent', () => {
    const fill = gpuFill(withGpuMs(buildPlaceholderRecording('lg'), 30))!;
    expect(fill.fill).toBe(1);
    expect(fill.percent).toBeCloseTo(150);
  });

  it('gives no fill when gpuMs is null', () => {
    expect(gpuFill(withGpuMs(buildPlaceholderRecording('lg'), null))).toBeNull();
  });

  it('falls back to measured cadence on an unknown display', () => {
    const recording = buildPlaceholderRecording('lg');
    recording.capture.display = 'unknown';
    expect(frameBudget(recording)?.budgetMs).toBe(20);
  });
});
