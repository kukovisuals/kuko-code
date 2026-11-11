import { describe, expect, it } from 'vitest';
import hardwareMap from '../data/hardware-map.m2.json';
import { compileEffect } from '../src/city/live/compileEffect';
import { LiveRecorder, needsRedraw } from '../src/city/live/liveRecorder';
import { FRAME_SLOWDOWN, dotsForBytes, frameTrip, sampleTrip } from '../src/city/live/trafficPlan';
import { fileReadRow, flowRow, httpRow, programRow } from '../src/city/live/wireRows';
import type { ProgramEvent } from '../src/shared/liveEvents';
import type { HardwareMap } from '../src/shared/types';
import { validateRecording } from '../src/shared/validateRecording';

const map = hardwareMap as HardwareMap;
const environment = { browserMajor: 156, glRenderer: 'ANGLE', timerQueryExposed: true, parallelCompileExposed: true, timeElapsedBits: 64, timestampBits: 0 };
const at = Date.UTC(2026, 10, 6);

function started(): LiveRecorder {
  const recorder = new LiveRecorder();
  recorder.add({ type: 'env', at, environment, width: 1280, height: 800, devicePixelRatio: 2, crossOriginIsolated: true });
  recorder.add({ type: 'source', at, bytes: 100, sha256: 'a'.repeat(64) });
  return recorder;
}

const frame = (index: number, gpuMs: number): ProgramEvent => ({ type: 'frame', at, frame: index, callsMs: 0.5, deltaMs: index === 0 ? null : 16.7, gpuMs });
const metricOf = (recording: NonNullable<ReturnType<LiveRecorder['toRecording']>>, stop: number, id: string) =>
  recording.stops.find((entry) => entry.stop === stop)?.metrics.find((metric) => metric.id === id);

describe('LiveRecorder', () => {
  it('gives nothing until the program has reported itself', () => {
    expect(new LiveRecorder().toRecording(map, 'lg')).toBeNull();
  });

  it('leaves values it has no event for as null, and still passes the schema', () => {
    const recording = started().toRecording(map, 'lg');
    expect(recording && metricOf(recording, 6, 'gpuMs')?.value).toBeNull();
    expect(recording && metricOf(recording, 1, 'fetchMs')?.value).toBeNull();
    expect(validateRecording(recording).ok).toBe(true);
  });

  it('keeps warmup frames out of the GPU median', () => {
    const recorder = started();
    for (let index = 0; index < 60; index += 1) recorder.add(frame(index, 100));
    for (let index = 60; index < 90; index += 1) recorder.add(frame(index, 10));
    const recording = recorder.toRecording(map, 'lg');
    expect(recording && metricOf(recording, 6, 'gpuMs')?.value).toBe(10);
    expect(recording && metricOf(recording, 6, 'gpuMsWarmup')?.value).toBe(100);
    expect(validateRecording(recording).ok).toBe(true);
  });

  it('labels stop 7 modeled and gives stops 7 and 8 no floors', () => {
    const recording = started().toRecording(map, 'lg');
    expect(recording?.stops.find((entry) => entry.stop === 7)?.status).toBe('modeled');
    expect(recording?.stops.find((entry) => entry.stop === 7)?.floors).toEqual([]);
    expect(recording?.stops.find((entry) => entry.stop === 8)?.floors).toEqual([]);
  });

  it('forgets a run on reset', () => {
    const recorder = started();
    recorder.reset();
    expect(recorder.toRecording(map, 'lg')).toBeNull();
  });
});

describe('needsRedraw', () => {
  it('ignores small changes, but not a large one or a new value', () => {
    const recorder = started();
    for (let index = 60; index < 90; index += 1) recorder.add(frame(index, 10));
    const before = recorder.toRecording(map, 'lg');
    const same = recorder.toRecording(map, 'lg');
    expect(same && needsRedraw(before, same)).toBe(false);
    for (let index = 90; index < 500; index += 1) recorder.add(frame(index, 20));
    const changed = recorder.toRecording(map, 'lg');
    expect(changed && needsRedraw(before, changed)).toBe(true);
  });
});

describe('traffic plan', () => {
  it('holds a frame at stop 6 for its own GPU time, slowed by the printed factor', () => {
    const wait = frameTrip(0.5, 14, 'lg').find((step) => step.stop === 6);
    expect(wait?.durationSec).toBeCloseTo((14 * FRAME_SLOWDOWN) / 1000);
  });

  it('ends a frame on the display in use', () => {
    const steps = frameTrip(0.5, 14, 'lg');
    const total = steps.reduce((sum, step) => sum + step.durationSec, 0);
    expect(sampleTrip(steps, total - 0.0001)?.position[0]).toBeCloseTo(20, 0);
    expect(sampleTrip(steps, total + 1)).toBeNull();
  });

  it('draws no dots for no traffic, and caps a flood', () => {
    expect(dotsForBytes(0)).toBe(0);
    expect(dotsForBytes(500)).toBe(1);
    expect(dotsForBytes(1e12)).toBe(6);
  });
});

describe('capture rows', () => {
  const rows = [
    httpRow({ type: 'http', at, method: 'GET', path: '/x.js', status: 200, bytes: 2048, serverMs: 1.5, serverPort: 5173, clientPort: 52000 }),
    flowRow({ serverPort: 5173, clientPort: 52000, inBytes: 10, outBytes: 20, isThisFeed: true }, at),
    programRow(frame(30, 14)),
    programRow({ type: 'compile', at, callsMs: 1, compileMs: 2 }),
    fileReadRow({ type: 'file-read', at, file: 'shaders/day442-image.glsl', bytes: 2048, ms: 0.12 }),
  ];

  it('never makes a row without a status and a source', () => {
    rows.forEach((row) => {
      expect(row?.status).toBeTruthy();
      expect(row?.source).toBeTruthy();
    });
  });

  it('puts the live feed in its own group, and says what it is', () => {
    expect(rows[1]?.group).toBe('feed');
    expect(rows[1]?.info).toContain('live feed');
  });

  it('shows nothing for events with no row of their own', () => {
    expect(programRow({ type: 'source', at, bytes: 1, sha256: 'a' })).toBeNull();
  });
});

describe('compileEffect', () => {
  const sample = (index: number, percent: number) => ({ from: index * 500, to: (index + 1) * 500, percent });
  const build = { from: 2100, to: 2300 };

  it('says the build raised the reading when the overlapping sample is clearly higher', () => {
    const result = compileEffect([sample(0, 10), sample(1, 12), sample(2, 11), sample(3, 11), sample(4, 30)], build);
    expect(result.verdict).toBe('rose');
    expect(result.text).toContain('11% before, 30% during');
  });

  it('says plainly when it did not', () => {
    const result = compileEffect([sample(0, 10), sample(1, 12), sample(2, 11), sample(3, 11), sample(4, 13)], build);
    expect(result.verdict).toBe('no-rise');
    expect(result.text).toContain('did not visibly raise');
    expect(result.text).toContain('200 ms inside a 500 ms sample');
  });

  it('claims nothing without a sample from before the build, or one covering it', () => {
    expect(compileEffect([sample(4, 30)], build).verdict).toBe('unknown');
    expect(compileEffect([sample(0, 10)], build).verdict).toBe('unknown');
  });
});
