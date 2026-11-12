// Stop 2: how long JS spends issuing WebGL calls. The calls mostly write commands into Chrome's
// command buffer and return, so this is the cost of asking, not of the work. Each trip also takes
// its stop 3 reading here, at the moment that trip crosses into the GPU process.
import type { Metric } from '../shared/types';
import { FULLSCREEN_TRIANGLE_VERTEX } from './fullscreenTriangle';
import { drainQueue, roundTripMetric, timeRoundTrip } from './measureRoundTrip';
import { summarize } from './summarize';

export interface TripResult {
  calls: Metric;
  roundTrip: Metric;
}

export interface BuildTripResult extends TripResult {
  // The last repeat's program, kept so the frame trip has something to draw.
  program: WebGLProgram;
}

interface BuiltProgram {
  program: WebGLProgram;
  shaders: WebGLShader[];
}

// The page can't read the clock any finer than this, so the source text names it.
function clockNote(): string {
  return self.crossOriginIsolated
    ? 'performance.now() is cross-origin isolated here, so it steps in about 5 µs.'
    : 'performance.now() is not cross-origin isolated here, so it steps in about 100 µs.';
}

function callMetric(id: string, readings: number[], what: string, note?: string): Metric {
  const stats = summarize(readings);
  return {
    id,
    value: stats?.median ?? null,
    unit: 'ms',
    status: 'measured',
    source: `performance.now() around ${what}. ${readings.length} readings. ${clockNote()}`,
    ...(note ? { note } : {}),
    ...(stats ? { stats } : {}),
  };
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('gl.createShader returned null. Is the context lost?');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

// Only calls that queue work. Asking for COMPILE_STATUS or LINK_STATUS here would wait for the
// compiler, which is stop 4 and 5's time, not stop 2's.
function issueBuildCalls(gl: WebGL2RenderingContext, fragmentSource: string): BuiltProgram {
  const vertex = createShader(gl, gl.VERTEX_SHADER, FULLSCREEN_TRIANGLE_VERTEX);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return { program, shaders: [vertex, fragment] };
}

// Blocking read: waits for the GPU process to finish the build, so the queue is empty afterwards.
// T11 and T12 own clean failure handling; here a failed build just stops the run with its logs.
function waitForLink(gl: WebGL2RenderingContext, built: BuiltProgram): void {
  if (gl.getProgramParameter(built.program, gl.LINK_STATUS)) return;
  const logs = [
    ...built.shaders.map((shader) => gl.getShaderInfoLog(shader)),
    gl.getProgramInfoLog(built.program),
  ].filter(Boolean);
  throw new Error(`The shader did not build:\n${logs.join('\n')}`);
}

function deleteBuilt(gl: WebGL2RenderingContext, built: BuiltProgram): void {
  for (const shader of built.shaders) gl.deleteShader(shader);
  gl.deleteProgram(built.program);
}

export function measureBuildTrip(
  gl: WebGL2RenderingContext,
  fragmentSource: string,
  repeats: number,
): BuildTripResult {
  const callReadings: number[] = [];
  const tripReadings: number[] = [];
  let previous: BuiltProgram | null = null;
  // Start from an empty queue, so the first repeat isn't waiting on earlier page work.
  drainQueue(gl);
  for (let run = 0; run < repeats; run += 1) {
    const start = performance.now();
    const built = issueBuildCalls(gl, fragmentSource);
    callReadings.push(performance.now() - start);
    waitForLink(gl, built);
    tripReadings.push(timeRoundTrip(gl));
    // Delete the old copy and drain again, untimed, so the next repeat also starts from empty.
    if (previous) deleteBuilt(gl, previous);
    drainQueue(gl);
    previous = built;
  }
  if (!previous) throw new Error('measureBuildTrip needs at least one repeat');
  return {
    calls: callMetric(
      'buildCallsMs',
      callReadings,
      'the build calls: createShader, shaderSource and compileShader for the fixed vertex shader and ' +
        'this fragment shader, then createProgram, attachShader twice and linkProgram, with no status asked',
      'Each repeat builds fresh objects from the same text, so later repeats may hit a shader cache. ' +
        'That changes the GPU process work, not these calls, which do not wait for it.',
    ),
    roundTrip: roundTripMetric('build', tripReadings),
    program: previous.program,
  };
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

export interface FramePlan {
  warmupFrames: number;
  sampledFrames: number;
}

export async function measureFrameTrip(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  plan: FramePlan,
): Promise<TripResult> {
  // Looked up before the loop: the first lookup can make its own round trip.
  const timeLocation = gl.getUniformLocation(program, 'u_time');
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
  const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
  gl.viewport(0, 0, width, height);
  drainQueue(gl);
  const callReadings: number[] = [];
  const tripReadings: number[] = [];
  const firstFrame = await nextFrame();
  const total = 1 + plan.warmupFrames + plan.sampledFrames;
  for (let frame = 0; frame < total; frame += 1) {
    const now = frame === 0 ? firstFrame : await nextFrame();
    const start = performance.now();
    gl.useProgram(program);
    gl.uniform1f(timeLocation, (now - firstFrame) / 1000);
    gl.uniform2f(resolutionLocation, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const callsMs = performance.now() - start;
    // Frame 0 is T12's first draw, and warmup frames let JIT and caches settle. Neither is kept.
    if (frame <= plan.warmupFrames) continue;
    callReadings.push(callsMs);
    drainQueue(gl);
    tripReadings.push(timeRoundTrip(gl));
  }
  const missing = [timeLocation, resolutionLocation].some((location) => location === null);
  return {
    calls: callMetric(
      'frameCallsMs',
      callReadings,
      `one frame's calls in a requestAnimationFrame loop: useProgram, uniform1f(u_time), ` +
        `uniform2f(u_resolution) and drawArrays of 3 vertices, after ${plan.warmupFrames} warmup frames`,
      missing
        ? 'This shader lacks u_time or u_resolution, so that uniform call got a null location and returned at once.'
        : undefined,
    ),
    roundTrip: roundTripMetric('frame', tripReadings),
  };
}
