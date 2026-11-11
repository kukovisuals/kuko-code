import { describe, expect, it } from 'vitest';
import { compareRecordings, parseRecording } from '../src/city/loadRecording';
import { buildPlaceholderRecording, isPlaceholderRecording } from '../src/city/placeholderRecording';
import { buildTimeline, sampleTimeline } from '../src/city/replay';
import { validateRecording } from '../src/shared/validateRecording';

describe('buildTimeline', () => {
  const recording = buildPlaceholderRecording('built-in');
  const timeline = buildTimeline(recording);
  const dwells = timeline.steps.filter((step) => step.kind === 'dwell');

  it('visits the build trip before the frame loop', () => {
    const firstFrame = timeline.steps.findIndex((step) => step.trip === 'frame');
    const lastBuild = timeline.steps.map((step) => step.trip).lastIndexOf('build');
    expect(lastBuild).toBeLessThan(firstFrame);
  });

  it('dwells at metrics in trip order', () => {
    const buildOrder = dwells.filter((step) => step.trip === 'build').map((step) => step.metric?.id);
    expect(buildOrder).toEqual(['fetchMs', 'buildCallsMs', 'roundTripMs', 'compileMs', 'linkMs', 'firstDrawMs']);
  });

  it('dwells at stop 6 on every frame lap', () => {
    const frameOrder = dwells.filter((step) => step.trip === 'frame' && step.metric).map((step) => step.metric?.id);
    // The pipeline road reaches stop 2 first, then each lap ends back at stop 2.
    expect(frameOrder).toEqual([
      'frameCallsMs', 'roundTripMs', 'gpuMs', 'frameCallsMs',
      'roundTripMs', 'gpuMs', 'frameCallsMs',
    ]);
  });

  it('scales every dwell by the same factor within a trip', () => {
    const factors = dwells
      .filter((step) => step.trip === 'build' && step.metric)
      .map((step) => step.durationSec / (step.metric!.value as number));
    factors.forEach((factor) => expect(factor).toBeCloseTo(factors[0]));
    expect(factors[0]).toBeCloseTo(timeline.buildSlowdown / 1000);
  });

  it('gives stops 7 and 8 no metric dwell, only a note', () => {
    for (const stop of [7, 8]) {
      const steps = dwells.filter((step) => step.stop === stop);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.every((step) => step.metric === undefined && step.note)).toBe(true);
    }
  });

  it('samples a position while running and null when finished', () => {
    expect(sampleTimeline(timeline, 0)?.step.metric?.id).toBe('fetchMs');
    expect(sampleTimeline(timeline, timeline.totalSec + 1)).toBeNull();
  });
});

describe('placeholder recording', () => {
  it('passes the same validator as a real recording', () => {
    expect(validateRecording(buildPlaceholderRecording('built-in')).ok).toBe(true);
    expect(validateRecording(buildPlaceholderRecording('lg')).ok).toBe(true);
  });

  it('says INVENTED in every metric source and is detectable', () => {
    const recording = buildPlaceholderRecording('lg');
    expect(isPlaceholderRecording(recording)).toBe(true);
    for (const metric of recording.stops.flatMap((stop) => stop.metrics)) {
      expect(metric.source).toContain('INVENTED');
    }
  });
});

describe('loading and comparing', () => {
  it('rejects broken JSON and invalid recordings with reasons', () => {
    const broken = parseRecording('{nope');
    expect(broken.ok).toBe(false);
    const invalid = parseRecording('{"schemaVersion":1}');
    expect(invalid.ok).toBe(false);
    expect(invalid.ok ? [] : invalid.errors.length).toBeGreaterThan(0);
  });

  it('warns when compared recordings differ', () => {
    const a = buildPlaceholderRecording('built-in');
    const b = buildPlaceholderRecording('lg');
    expect(compareRecordings(a, b)).toEqual([]);
    b.shader.sha256 = 'a'.repeat(64);
    b.capture.drawingBuffer.width = 640;
    b.capture.cacheState = 'warm';
    expect(compareRecordings(a, b)).toHaveLength(3);
  });
});
