// Pure: collects the program's real events into the same Recording shape a saved file has, so the
// existing buildings can draw them. Values still waiting for their event stay null, never invented.
import type { ProgramEvent } from '../../shared/liveEvents';
import { LIVE_PROGRAM } from '../../shared/liveProgram';
import type { DisplayLabel, HardwareMap, Metric, MetricUnit, Recording, Stats, Status, Stop } from '../../shared/types';

export const WARMUP_FRAMES = 60;
const WINDOW_FRAMES = 300;
const TILE_SIZE = 32;
const SIMD_WIDTH = 32;
const LIVE_NOTE = 'Live, with the city drawing at the same time, so not recording quality';

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function summarize(values: number[]): Stats | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (share: number) => sorted[Math.min(Math.floor(share * sorted.length), sorted.length - 1)] as number;
  return { n: sorted.length, min: sorted[0] as number, median: pick(0.5), p95: pick(0.95), max: sorted[sorted.length - 1] as number };
}

function metric(id: string, value: number | null, unit: MetricUnit, status: Status, source: string, stats?: Stats | null): Metric {
  return { id, value, unit, status, source, note: LIVE_NOTE, ...(stats ? { stats } : {}) };
}

function statMetric(id: string, values: number[], status: Status, source: string): Metric {
  const stats = summarize(values);
  return metric(id, stats?.median ?? null, 'ms', status, source, stats);
}

export class LiveRecorder {
  private events: ProgramEvent[] = [];
  private gpuMs: number[] = [];
  private gpuWarmupMs: number[] = [];
  private callsMs: number[] = [];
  private deltaMs: number[] = [];
  private frames = 0;

  reset(): void {
    this.events = [];
    this.gpuMs = [];
    this.gpuWarmupMs = [];
    this.callsMs = [];
    this.deltaMs = [];
    this.frames = 0;
  }

  add(event: ProgramEvent): void {
    if (event.type !== 'frame') {
      this.events.push(event);
      return;
    }
    this.frames += 1;
    const gpu = event.gpuMs;
    // Frame 0 was timed on its own as the first draw, so its call time isn't a normal frame's.
    if (event.frame > 0) {
      pushWindow(this.callsMs, event.callsMs);
    }
    if (event.frame < WARMUP_FRAMES) {
      this.gpuWarmupMs.push(gpu);
    } else {
      pushWindow(this.gpuMs, gpu);
    }
    if (event.deltaMs !== null) {
      pushWindow(this.deltaMs, event.deltaMs);
    }
  }

  private ofType<T extends ProgramEvent['type']>(type: T): Extract<ProgramEvent, { type: T }>[] {
    return this.events.filter((event): event is Extract<ProgramEvent, { type: T }> => event.type === type);
  }

  // Null until the program has reported its environment and its source.
  toRecording(hardwareMap: HardwareMap, display: DisplayLabel): Recording | null {
    const env = this.ofType('env')[0];
    const source = this.ofType('source')[0];
    if (!env || !source) {
      return null;
    }
    const fetches = this.ofType('fetch');
    const compile = this.ofType('compile')[0];
    const link = this.ofType('link')[0];
    const single = (type: 'round-trip' | 'first-draw' | 'steady-draw') => this.events.flatMap((event) => (event.type === type ? [event.ms] : []))[0] ?? null;
    const median = summarize(this.deltaMs)?.median ?? null;
    const pixels = env.width * env.height;

    const stops: Stop[] = [
      stop(1, 'Network', 'network-road', 'measured', ['fetchMs'], [
        metric('fetchMs', fetches.length === 2 ? sum(fetches.map((entry) => entry.ms)) : null, 'ms', 'measured', 'PerformanceResourceTiming: 2 GLSL files (Common, Image) over loopback, one after another'),
      ]),
      stop(2, 'Renderer', 'cpu', 'measured', ['buildCallsMs', 'frameCallsMs'], [
        metric('buildCallsMs', compile && link ? compile.callsMs + link.callsMs : null, 'ms', 'measured', 'performance.now() around the compile and link calls, before waiting for their results'),
        statMetric('frameCallsMs', this.callsMs, 'measured', 'performance.now() around one frame of calls: 4 uniforms and 1 draw'),
      ]),
      stop(3, 'GPU process', 'cpu', 'partial', ['roundTripMs'], [
        metric('roundTripMs', single('round-trip'), 'ms', 'partial', 'Median of 7 gl.getError() calls, a proxy for crossing into the GPU process'),
      ]),
      stop(4, 'ANGLE', 'cpu', 'partial', ['compileMs'], [
        metric('compileMs', compile?.compileMs ?? null, 'ms', 'partial', 'compileShader plus blocking COMPILE_STATUS, vertex and fragment. Includes stops 2 and 3 overhead'),
      ]),
      stop(5, 'Metal compiler', 'cpu', 'partial', ['linkMs', 'firstDrawMs'], [
        metric('linkMs', link?.linkMs ?? null, 'ms', 'partial', 'linkProgram plus blocking LINK_STATUS. Includes ANGLE link work'),
        metric('firstDrawMs', single('first-draw'), 'ms', 'partial', 'First draw plus getError. Includes issuing the draw'),
        metric('steadyDrawMs', single('steady-draw'), 'ms', 'partial', 'One later draw plus getError, a baseline'),
      ]),
      stop(6, 'GPU tiles', 'gpu', 'partial', ['gpuMs'], [
        statMetric('gpuMs', this.gpuMs, 'partial', 'TIME_ELAPSED_EXT around the one draw of each frame, after warmup. A time range, not busy time'),
        statMetric('gpuMsWarmup', this.gpuWarmupMs, 'partial', `TIME_ELAPSED_EXT over the first ${WARMUP_FRAMES} frames`),
      ]),
      stop(7, 'SIMD groups', 'gpu-core', 'modeled', [], [
        metric('tileCount', Math.ceil(pixels / (TILE_SIZE * TILE_SIZE)), 'count', 'modeled', 'Drawing buffer pixels at 32 x 32 tiles. The driver picks real tile size'),
        metric('simdGroups', Math.ceil(pixels / SIMD_WIDTH), 'count', 'modeled', 'Drawing buffer pixels / 32, a lower bound'),
      ]),
      stop(8, 'Compositor + display', 'display-engines', 'partial', [], [
        statMetric('frameDeltaMs', this.deltaMs, 'partial', 'Median requestAnimationFrame delta. Compositor and scanout time are not measured'),
        metric('refreshHz', median === null ? null : 1000 / median, 'Hz', 'partial', 'Derived from the median rAF delta'),
      ]),
    ];

    return {
      schemaVersion: 1,
      recordedAt: new Date(env.at).toISOString(),
      environment: env.environment,
      capture: {
        cacheState: 'unknown',
        drawingBuffer: { width: env.width, height: env.height },
        devicePixelRatio: env.devicePixelRatio,
        display,
        warmupFrames: Math.min(this.frames, WARMUP_FRAMES),
        sampledFrames: Math.max(this.gpuMs.length, 1),
        crossOriginIsolated: env.crossOriginIsolated,
      },
      shader: { file: `shaders/${LIVE_PROGRAM.imageFile}.glsl`, bytes: source.bytes, sha256: source.sha256 },
      hardwareMap,
      stops,
      imports: [],
    };
  }
}

function pushWindow(values: number[], value: number): void {
  values.push(value);
  if (values.length > WINDOW_FRAMES) {
    values.shift();
  }
}

function stop(number: number, name: string, blockId: string, status: Status, floors: string[], metrics: Metric[]): Stop {
  return { stop: number, name, blockId, status, metrics, floors };
}

// Rebuilding a tower costs a little GPU time and resets the panel, so only a real change is worth it.
export function needsRedraw(before: Recording | null, after: Recording, threshold = 0.1): boolean {
  if (!before || before.capture.display !== after.capture.display) {
    return true;
  }
  const values = (recording: Recording) => recording.stops.flatMap((entry) => entry.metrics.map((item) => item.value));
  const old = values(before);
  return values(after).some((value, index) => {
    const previous = old[index] ?? null;
    if (value === null || previous === null) {
      return value !== previous;
    }
    return previous === 0 ? value !== 0 : Math.abs(value - previous) / Math.abs(previous) > threshold;
  });
}
