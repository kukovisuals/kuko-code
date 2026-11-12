import { describe, expect, it } from 'vitest';
import { frameSummary } from '../src/city/live/frameSummary';
import { buildPlaceholderRecording } from '../src/city/placeholderRecording';
import type { Recording } from '../src/shared/types';

function setMetric(recording: Recording, stop: number, id: string, value: number | null): void {
  recording.stops.find((entry) => entry.stop === stop)!.metrics.find((metric) => metric.id === id)!.value = value;
}

const row = (recording: Recording, name: string) => frameSummary(recording).find((entry) => entry.name === name)!;

describe('frameSummary', () => {
  it('gives every row a tag and a source', () => {
    for (const entry of frameSummary(buildPlaceholderRecording('built-in'))) {
      expect(entry.tag.trim()).not.toBe('');
      expect(entry.source.trim()).not.toBe('');
    }
  });

  it('works out the budget share and headroom from stop 6, and tags them modeled', () => {
    const recording = buildPlaceholderRecording('lg');
    setMetric(recording, 6, 'gpuMs', 5);
    expect(row(recording, 'Share of frame budget')).toMatchObject({ value: 25, unit: '%', tag: 'modeled' });
    expect(row(recording, 'Headroom per frame')).toMatchObject({ value: 15, tag: 'modeled' });
  });

  it('keeps the status of the metric a row came from', () => {
    const recording = buildPlaceholderRecording('built-in');
    const gpu = recording.stops.find((entry) => entry.stop === 6)!.metrics.find((metric) => metric.id === 'gpuMs')!;
    expect(row(recording, 'GPU time per frame, median').tag).toBe(gpu.status);
  });

  it('shows no value, never a guess, when a reading is missing', () => {
    const recording = buildPlaceholderRecording('built-in');
    setMetric(recording, 6, 'gpuMs', null);
    setMetric(recording, 4, 'compileMs', null);
    expect(row(recording, 'Share of frame budget').value).toBeNull();
    expect(row(recording, 'Headroom per frame').value).toBeNull();
    expect(row(recording, 'Build, once: compile + link + first draw').value).toBeNull();
  });

  it('puts a native reading on its own row, beside the browser row and never over it', () => {
    const recording = buildPlaceholderRecording('built-in');
    setMetric(recording, 6, 'gpuMs', 1.4);
    recording.imports = [{ tool: 'instruments', stop: 6, metrics: [{ id: 'nativeFragmentMs', value: 0.7, unit: 'ms', status: 'partial', source: 'Instruments, a test' }] }];
    expect(row(recording, 'GPU time per frame, median').value).toBe(1.4);
    expect(row(recording, 'GPU time per frame, Instruments (city closed)')).toMatchObject({ value: 0.7, tag: 'partial', native: true });
  });

  it('adds no native row when nothing was imported', () => {
    const names = frameSummary(buildPlaceholderRecording('built-in')).map((entry) => entry.name);
    expect(names.some((name) => name.includes('Instruments'))).toBe(false);
  });
});
