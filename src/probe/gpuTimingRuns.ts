// The three T05 measurements: the timer query, the readPixels wall clock, and frame cadence.
import { getTimerQueryExt, type TimerQueryExt } from '../record/probeEnvironment';

export interface Stats {
  n: number;
  min: number;
  median: number;
  p95: number;
  max: number;
}

export function stats(values: number[]): Stats {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (fraction: number) => sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))] ?? NaN;
  return { n: sorted.length, min: sorted[0] ?? NaN, median: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] ?? NaN };
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function requireTimer(gl: WebGL2RenderingContext): TimerQueryExt {
  const ext = getTimerQueryExt(gl);
  if (!ext) throw new Error('EXT_disjoint_timer_query_webgl2 is not exposed');
  return ext;
}

function drawFrame(gl: WebGL2RenderingContext, program: WebGLProgram): void {
  gl.uniform1f(gl.getUniformLocation(program, 'u_time'), performance.now() / 1000);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function prepare(gl: WebGL2RenderingContext, program: WebGLProgram, width: number, height: number): void {
  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.width = width;
  canvas.height = height;
  gl.viewport(0, 0, width, height);
  gl.useProgram(program);
  gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), width, height);
}

interface PendingQuery {
  query: WebGLQuery;
  frame: number;
}

// Tracks queries submitted on earlier frames and collects the ones that have finished.
class QueryTracker {
  private pending: PendingQuery[] = [];
  readonly results: { frame: number; ms: number; lagFrames: number }[] = [];
  disjointReads = 0;

  constructor(
    private gl: WebGL2RenderingContext,
    private ext: TimerQueryExt,
  ) {}

  drawTimed(program: WebGLProgram, frame: number): void {
    const query = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    drawFrame(this.gl, program);
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push({ query, frame });
  }

  // Only asks for a result once it is available: asking early would make ANGLE wait for the GPU.
  poll(frame: number): void {
    if (this.gl.getParameter(this.ext.GPU_DISJOINT_EXT)) this.disjointReads += 1;
    while (this.pending.length > 0) {
      const head = this.pending[0] as PendingQuery;
      if (!this.gl.getQueryParameter(head.query, this.gl.QUERY_RESULT_AVAILABLE)) return;
      const nanoseconds = Number(this.gl.getQueryParameter(head.query, this.gl.QUERY_RESULT));
      this.results.push({ frame: head.frame, ms: nanoseconds / 1e6, lagFrames: frame - head.frame });
      this.gl.deleteQuery(head.query);
      this.pending.shift();
    }
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  discardPending(): void {
    this.pending.forEach(({ query }) => this.gl.deleteQuery(query));
    this.pending = [];
  }
}

// Counts samples in 0.5 ms bins, keyed by each bin's lower edge. A median can't show two clusters.
function histogram(values: number[]): Record<string, number> {
  const bins = new Map<number, number>();
  for (const value of values) {
    const edge = Math.floor(value * 2) / 2;
    bins.set(edge, (bins.get(edge) ?? 0) + 1);
  }
  const sorted = [...bins.entries()].sort(([a], [b]) => a - b);
  return Object.fromEntries(sorted.map(([edge, count]) => [edge.toFixed(1), count]));
}

// The median of each block of 50 frames, in time order, to show whether a level holds or drifts.
function blockMedians(values: number[]): number[] {
  const medians: number[] = [];
  for (let start = 0; start < values.length; start += 50) {
    medians.push(stats(values.slice(start, start + 50)).median);
  }
  return medians;
}

export interface QueryRun {
  gpuMs: Stats;
  gpuMsHistogram: Record<string, number>;
  gpuMsBlockMedians: number[];
  warmupGpuMs: Stats;
  medianLagFrames: number;
  neverReturned: number;
  disjointReads: number;
}

export async function runTimerQuery(gl: WebGL2RenderingContext, program: WebGLProgram, warmup: number, samples: number): Promise<QueryRun> {
  const tracker = new QueryTracker(gl, requireTimer(gl));
  const total = warmup + samples;
  let frame = 0;
  for (; frame < total; frame++) {
    await nextFrame();
    tracker.poll(frame);
    tracker.drawTimed(program, frame);
  }
  // Results arrive frames after the draw, so keep polling briefly once drawing stops.
  for (let extra = 0; extra < 120 && tracker.pendingCount > 0; extra++) {
    await nextFrame();
    tracker.poll(frame + extra);
  }
  const neverReturned = tracker.pendingCount;
  tracker.discardPending();
  const sampled = tracker.results.filter((r) => r.frame >= warmup).map((r) => r.ms);
  return {
    gpuMs: stats(sampled),
    gpuMsHistogram: histogram(sampled),
    gpuMsBlockMedians: blockMedians(sampled),
    warmupGpuMs: stats(tracker.results.filter((r) => r.frame < warmup).map((r) => r.ms)),
    medianLagFrames: stats(tracker.results.map((r) => r.lagFrames)).median,
    neverReturned,
    disjointReads: tracker.disjointReads,
  };
}

export interface ReadPixelsRun {
  drawPlusReadMs: Stats;
  // A second read right after the first, with no new draw: the cost of the read itself.
  readOnlyMs: Stats;
}

export async function runReadPixels(gl: WebGL2RenderingContext, program: WebGLProgram, warmup: number, samples: number): Promise<ReadPixelsRun> {
  const pixel = new Uint8Array(4);
  const drawPlusRead: number[] = [];
  const readOnly: number[] = [];
  for (let frame = 0; frame < warmup + samples; frame++) {
    await nextFrame();
    const start = performance.now();
    drawFrame(gl, program);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const afterDraw = performance.now();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const afterRead = performance.now();
    if (frame >= warmup) {
      drawPlusRead.push(afterDraw - start);
      readOnly.push(afterRead - afterDraw);
    }
  }
  return { drawPlusReadMs: stats(drawPlusRead), readOnlyMs: stats(readOnly) };
}

export interface CadenceRun {
  queryOn: boolean;
  frameDeltaMs: Stats;
  // Frames that took over 1.5 times the median, which usually means a missed refresh.
  longFrames: number;
}

export async function runCadence(gl: WebGL2RenderingContext, program: WebGLProgram, queryOn: boolean, warmup: number, samples: number): Promise<CadenceRun> {
  const tracker = queryOn ? new QueryTracker(gl, requireTimer(gl)) : null;
  const deltas: number[] = [];
  let previous = await nextFrame();
  for (let frame = 0; frame < warmup + samples; frame++) {
    const now = await nextFrame();
    if (frame >= warmup) deltas.push(now - previous);
    previous = now;
    if (tracker) {
      tracker.poll(frame);
      tracker.drawTimed(program, frame);
    } else {
      drawFrame(gl, program);
    }
  }
  tracker?.discardPending();
  const frameDeltaMs = stats(deltas);
  return { queryOn, frameDeltaMs, longFrames: deltas.filter((d) => d > frameDeltaMs.median * 1.5).length };
}
