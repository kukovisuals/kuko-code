// Runs the live shader inside the city page's frame and reports what really happens to the page around it.
// It draws no city and saves nothing. With the city drawing beside it, these aren't recording-quality numbers.
import { getTimerQueryExt, probeEnvironment } from '../record/probeEnvironment';
import { PROGRAM_MESSAGE, type ProgramEvent, type ProgramMessage } from '../shared/liveEvents';
import { LIVE_PROGRAM } from '../shared/liveProgram';
import { PassTimer } from '../shaderView/passTimer';
import { buildLiveProgram } from './buildPasses';
import { ImageRenderer, type FrameInputs } from './imageRenderer';

const STEADY_DRAW_FRAME = 60;
const ROUND_TRIPS = 7;

function report(event: ProgramEvent): void {
  const message: ProgramMessage = { channel: PROGRAM_MESSAGE, event };
  window.parent.postMessage(message, location.origin);
}

function medianRoundTrip(gl: WebGL2RenderingContext): number {
  const samples: number[] = [];
  for (let index = 0; index < ROUND_TRIPS; index += 1) {
    const startedAt = performance.now();
    gl.getError();
    samples.push(performance.now() - startedAt);
  }
  return samples.sort((a, b) => a - b)[Math.floor(ROUND_TRIPS / 2)] as number;
}

interface PendingFrame {
  callsMs: number;
  deltaMs: number | null;
}

async function start(): Promise<void> {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  canvas.width = LIVE_PROGRAM.width;
  canvas.height = LIVE_PROGRAM.height;
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false });
  if (!gl) throw new Error('WebGL2 is not available');
  const timerExt = getTimerQueryExt(gl);
  if (!timerExt) throw new Error("EXT_disjoint_timer_query_webgl2 is not exposed, so GPU time can't be measured here.");
  report({
    type: 'env',
    at: Date.now(),
    environment: probeEnvironment(gl),
    width: LIVE_PROGRAM.width,
    height: LIVE_PROGRAM.height,
    devicePixelRatio: window.devicePixelRatio,
    crossOriginIsolated: self.crossOriginIsolated,
  });

  const program = await buildLiveProgram(gl, report);
  const renderer = new ImageRenderer(gl, program, LIVE_PROGRAM.width, LIVE_PROGRAM.height);
  report({ type: 'round-trip', at: Date.now(), ms: medianRoundTrip(gl) });

  const pending = new Map<number, PendingFrame>();
  // The GPU's answer arrives a few frames after the draw call that asked for it.
  const timer = new PassTimer<number>(gl, timerExt, (frame, gpuMs) => {
    const entry = pending.get(frame);
    if (!entry) return;
    pending.delete(frame);
    report({ type: 'frame', at: Date.now(), frame, callsMs: entry.callsMs, deltaMs: entry.deltaMs, gpuMs });
  });

  const startedAt = performance.now();
  const mouse: FrameInputs['mouse'] = [0, 0, 0, 0];
  const inputsAt = (now: number, frame: number): FrameInputs => ({ time: (now - startedAt) / 1000, frame, mouse });
  const drawFrame = (inputs: FrameInputs) => timer.timed(inputs.frame, () => renderer.draw(inputs));

  // The first draw is where the driver builds its pipeline, so it is timed apart from the rest.
  const drawStartedAt = performance.now();
  pending.set(0, { callsMs: 0, deltaMs: null });
  drawFrame(inputsAt(drawStartedAt, 0));
  gl.getError();
  report({ type: 'first-draw', at: Date.now(), ms: performance.now() - drawStartedAt });

  let frame = 1;
  let lastTime = 0;
  const tick = (now: number) => {
    requestAnimationFrame(tick);
    timer.poll();
    const deltaMs = lastTime > 0 ? now - lastTime : null;
    lastTime = now;
    const inputs = inputsAt(now, frame);
    const callsStartedAt = performance.now();
    drawFrame(inputs);
    const callsMs = performance.now() - callsStartedAt;
    pending.set(frame, { callsMs, deltaMs });
    // Only one frame pays for this forced wait, so it can't slow the frames being sampled.
    if (frame === STEADY_DRAW_FRAME) {
      const steadyStartedAt = performance.now();
      renderer.draw(inputs);
      gl.getError();
      report({ type: 'steady-draw', at: Date.now(), ms: performance.now() - steadyStartedAt });
    }
    frame += 1;
  };
  requestAnimationFrame(tick);
}

start().catch((error: unknown) => {
  report({ type: 'error', at: Date.now(), message: error instanceof Error ? error.message : String(error) });
});
