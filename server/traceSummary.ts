// Pure: turns Metal System Trace tables into entries for a recording's imports[] slot.
// Only numbers leave this file. Process names, thread ids and labels from the trace are read and dropped.
import { summarize } from '../src/record/summarize.ts';
import type { Metric, NativeImport, Stats } from '../src/shared/types';
import type { TraceRow } from './traceTable.ts';

const NS_PER_MS = 1e6;
const GPU_RUN_STOP = 6;
const DRIVER_BUILD_STOP = 5;

export interface TraceContext {
  // The day the trace was recorded, as YYYY-MM-DD.
  tracedOn: string;
  // What was on screen, in plain words. It goes into every source line.
  scene: string;
}

// Chrome's GPU process is the one process whose name carries "Chrome Helper" and that submits Metal work.
const isChromeGpu = (row: TraceRow) => (row.process?.fmt ?? '').includes('Chrome Helper');
const ms = (row: TraceRow) => Number(row.duration?.text) / NS_PER_MS;
const startMs = (row: TraceRow) => Number(row.start?.text) / NS_PER_MS;

function metric(id: string, stats: Stats | null, status: Metric['status'], source: string, note?: string): Metric {
  return { id, value: stats?.median ?? null, unit: 'ms', status, source, ...(stats ? { stats } : {}), ...(note ? { note } : {}) };
}

export interface ShaderPasses {
  fragmentMs: number[];
  vertexMs: number[];
  seconds: number;
  // Every GPU interval of Chrome's GPU process, added up.
  allChromeMs: number;
}

// ANGLE gives its Metal passes no labels, so the shader's pass is picked by shape (inferred):
// a command buffer with one render pass, which ran once in the vertex channel and once in the fragment channel.
export function findShaderPasses(gpuIntervals: TraceRow[]): ShaderPasses {
  const chrome = gpuIntervals.filter(isChromeGpu);
  const buffers = new Map<string, TraceRow[]>();
  for (const row of chrome) {
    const id = row['cmdbuffer-id']?.text ?? '';
    buffers.set(id, [...(buffers.get(id) ?? []), row]);
  }
  const fragmentMs: number[] = [];
  const vertexMs: number[] = [];
  for (const rows of buffers.values()) {
    const encoders = new Set(rows.map((row) => row['encoder-id']?.text));
    const fragment = rows.filter((row) => row['channel-name']?.text === 'Fragment');
    const vertex = rows.filter((row) => row['channel-name']?.text === 'Vertex');
    if (encoders.size !== 1 || rows.length !== 2 || fragment.length !== 1 || vertex.length !== 1) continue;
    fragmentMs.push(ms(fragment[0] as TraceRow));
    vertexMs.push(ms(vertex[0] as TraceRow));
  }
  const starts = chrome.map(startMs);
  const seconds = chrome.length > 1 ? (Math.max(...starts) - Math.min(...starts)) / 1000 : 0;
  return { fragmentMs, vertexMs, seconds, allChromeMs: chrome.reduce((sum, row) => sum + ms(row), 0) };
}

export function gpuRunImport(gpuIntervals: TraceRow[], context: TraceContext): NativeImport {
  const passes = findShaderPasses(gpuIntervals);
  const from = `Instruments Metal System Trace, table metal-gpu-intervals, Chrome's GPU process, ${context.scene}, ${context.tracedOn}`;
  const picked = 'Which pass is the shader is inferred: ANGLE labels nothing, so it is the command buffer with a single render pass.';
  const rate = passes.seconds > 0 ? passes.fragmentMs.length / passes.seconds : null;
  const busy = passes.seconds > 0 ? (passes.allChromeMs / (passes.seconds * 1000)) * 100 : null;
  return {
    tool: 'instruments',
    stop: GPU_RUN_STOP,
    metrics: [
      metric('nativeFragmentMs', summarize(passes.fragmentMs), 'partial', `${from}. Fragment channel time of the shader's pass`, picked),
      metric('nativeVertexMs', summarize(passes.vertexMs), 'partial', `${from}. Vertex channel time of the same pass (the tiler's share)`, picked),
      { id: 'nativePassHz', value: rate, unit: 'Hz', status: 'partial', source: `${from}. Shader passes found, divided by the seconds traced` },
      {
        id: 'nativeGpuProcessBusy',
        value: busy,
        unit: 'percent',
        status: 'partial',
        source: `${from}. All of that process's GPU intervals added up, over the seconds traced. Includes Chrome drawing its own page`,
      },
    ],
  };
}

// One row per shader stage that Metal's compiler worked on for Chrome's GPU process.
export function driverBuildImport(compilerIntervals: TraceRow[], context: TraceContext): NativeImport {
  const chrome = compilerIntervals.filter(isChromeGpu);
  const stage = (name: string) => chrome.filter((row) => (row['program-type']?.fmt ?? '').includes(`Compile ${name} shader`)).map(ms);
  const from = `Instruments Metal System Trace, table graphics-compiler-activity-intervals, Chrome's GPU process, ${context.scene}, ${context.tracedOn}`;
  const note = 'Cache state unknown. The trace can not say which program a compile belongs to, so every compile in the trace is counted.';
  return {
    tool: 'instruments',
    stop: DRIVER_BUILD_STOP,
    metrics: [
      metric('nativeFragmentCompileMs', summarize(stage('Fragment')), 'partial', `${from}. Metal Shader Compiler, fragment stage`, note),
      metric('nativeVertexCompileMs', summarize(stage('Vertex')), 'partial', `${from}. Metal Shader Compiler, vertex stage`, note),
    ],
  };
}

// Serial numbers, UUIDs, UDIDs and MAC addresses have these shapes. An import that matches one is refused.
const IDENTIFIER_SHAPES = [
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  /\b[0-9a-f]{8}-[0-9a-f]{16}\b/i,
  /\b[0-9a-f]{40}\b/i,
  /\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/i,
  /\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{10,12}\b/,
  /\/Users\//,
  /pid\b|\(\d{2,}\)/i,
];

export function findIdentifiers(imports: NativeImport[]): string[] {
  const text = JSON.stringify(imports);
  return IDENTIFIER_SHAPES.filter((shape) => shape.test(text)).map((shape) => String(shape));
}
