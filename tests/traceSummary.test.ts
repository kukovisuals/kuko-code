import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { driverBuildImport, findIdentifiers, findShaderPasses, gpuRunImport } from '../server/traceSummary';
import { parseTraceTable, type TraceRow } from '../server/traceTable';
import { validateRecording } from '../src/shared/validateRecording';
import validRecording from './fixtures/valid-recording.json';

// Made by hand in the export's shape: two shader passes, one two-pass command buffer, one other process.
const rows = parseTraceTable(readFileSync(new URL('./fixtures/trace-gpu-intervals.xml', import.meta.url), 'utf8'));
const context = { tracedOn: '2026-11-12', scene: 'a test scene' };

const compileRow = (process: string, stage: string, ns: number): TraceRow => ({
  start: { text: '0', fmt: '0' },
  duration: { text: String(ns), fmt: '' },
  'program-type': { text: '', fmt: `Compile ${stage} shader (${process})` },
  process: { text: '', fmt: process },
});

describe('parseTraceTable', () => {
  it('follows refs, including ones first defined inside another element', () => {
    expect(rows).toHaveLength(7);
    expect(rows[1]?.process?.fmt).toBe('Fake Chrome Helper (GPU) (111)');
    expect(rows[2]?.duration?.text).toBe('10000');
    expect(rows[0]?.['frame-number']).toBeNull();
    expect(rows[1]?.['cmdbuffer-id']?.text).toBe('161');
  });
});

describe('findShaderPasses', () => {
  it('keeps only single-pass command buffers of the Chrome GPU process', () => {
    const passes = findShaderPasses(rows);
    expect(passes.fragmentMs).toEqual([0.7, 0.9]);
    expect(passes.vertexMs).toEqual([0.01, 0.01]);
    expect(passes.allChromeMs).toBeCloseTo(2.22);
  });
});

describe('trace imports', () => {
  const imports = [
    gpuRunImport(rows, context),
    driverBuildImport([compileRow('Fake Chrome Helper (GPU) (111)', 'Fragment', 2_500_000), compileRow('replayd (333)', 'Fragment', 9_000_000)], context),
  ];

  it('gives every metric a status and a source, and fits the recording schema', () => {
    for (const metric of imports.flatMap((entry) => entry.metrics)) {
      expect(metric.status).toBe('partial');
      expect(metric.source).toContain('Instruments');
    }
    expect(validateRecording({ ...validRecording, imports })).toMatchObject({ ok: true });
  });

  it('puts GPU time on stop 6 and compile time on stop 5, and ignores other processes', () => {
    expect(imports[0]).toMatchObject({ stop: 6 });
    expect(imports[0]?.metrics[0]).toMatchObject({ id: 'nativeFragmentMs', value: 0.8, stats: { n: 2 } });
    expect(imports[1]?.metrics[0]).toMatchObject({ id: 'nativeFragmentCompileMs', value: 2.5, stats: { n: 1 } });
    expect(imports[1]?.metrics[1]).toMatchObject({ id: 'nativeVertexCompileMs', value: null });
  });

  it('carries no process name, pid or identifier', () => {
    expect(JSON.stringify(imports)).not.toMatch(/Fake|\(111\)|replayd/);
    expect(findIdentifiers(imports)).toEqual([]);
  });

  it('refuses text shaped like a device identifier', () => {
    const leaky = [{ ...imports[0]!, metrics: [{ ...imports[0]!.metrics[0]!, source: 'device 00008112-001A2B3C4D5E6F70' }] }];
    expect(findIdentifiers(leaky)).not.toEqual([]);
  });
});
