// The recorder page. Raw browser APIs only, no Three.js and nothing animating, so it measures the
// shader and not itself. Each ticket adds a section per stop; T10 added stops 2 and 3.
import { listShaderFiles, measureFetch } from './fetchShader';
import { measureBuildTrip, measureFrameTrip } from './measureCallTime';
import { metricView } from './metricView';

const FETCH_REPEATS = 20;
const BUILD_REPEATS = 20;
const FRAME_PLAN = { warmupFrames: 10, sampledFrames: 60 };

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`record.html is missing #${id}`);
  return element as T;
}

const picker = byId<HTMLSelectElement>('shader');
const runButton = byId<HTMLButtonElement>('run');
const stop1 = byId<HTMLDivElement>('stop-1');
const stop2 = byId<HTMLDivElement>('stop-2');
const stop3 = byId<HTMLDivElement>('stop-3');

// No MSAA, so later GPU timings are the shader's work and not a resolve pass the page asked for.
const gl = byId<HTMLCanvasElement>('canvas').getContext('webgl2', {
  antialias: false,
  preserveDrawingBuffer: false,
});

// performance.now() is coarser without cross-origin isolation, so show whether the headers took effect.
byId('isolation').textContent = `crossOriginIsolated: ${self.crossOriginIsolated}`;

for (const file of listShaderFiles()) {
  picker.append(new Option(file, file));
}

function paragraph(text: string): HTMLParagraphElement {
  const element = document.createElement('p');
  element.textContent = text;
  return element;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Returns the shader text when stops 2 and 3 can use it, or null when they can't.
async function runStop1(): Promise<string | null> {
  stop1.replaceChildren(paragraph(`Fetching ${picker.value} ${FETCH_REPEATS} times...`));
  const result = await measureFetch(picker.value, FETCH_REPEATS);
  const kind = result.plainFragmentShader
    ? 'Plain #version 300 es fragment shader: the later stops can record it.'
    : 'Not a plain #version 300 es fragment shader (a Shadertoy-style pass). Stop 1 can time it, ' +
      'but stops 2 to 8 take plain fragment shaders only for now (D3 in docs/backlog.md).';
  stop1.replaceChildren(
    metricView(result.metric),
    paragraph(`bytes: ${result.shader.bytes} (measured: length of the response body)`),
    paragraph(`sha256: ${result.shader.sha256} (measured: crypto.subtle over the response body)`),
    paragraph(kind),
  );
  return result.plainFragmentShader ? result.text : null;
}

// Build trip first, then the frame loop draws the program the build left behind.
async function runStops2And3(context: WebGL2RenderingContext, source: string): Promise<void> {
  stop2.replaceChildren(paragraph(`Building ${BUILD_REPEATS} times, then drawing...`));
  const build = measureBuildTrip(context, source, BUILD_REPEATS);
  try {
    const frame = await measureFrameTrip(context, build.program, FRAME_PLAN);
    stop2.replaceChildren(metricView(build.calls), metricView(frame.calls));
    stop3.replaceChildren(metricView(build.roundTrip), metricView(frame.roundTrip));
  } finally {
    context.deleteProgram(build.program);
  }
}

async function run(): Promise<void> {
  runButton.disabled = true;
  stop2.replaceChildren();
  stop3.replaceChildren();
  let stop = 1;
  try {
    const source = await runStop1();
    if (source === null) return;
    if (!gl) throw new Error('This browser gave no WebGL2 context.');
    stop = 2;
    await runStops2And3(gl, source);
  } catch (error) {
    const failed = stop === 1 ? stop1 : stop2;
    failed.replaceChildren(paragraph(`Stop ${stop} failed: ${message(error)}`));
  } finally {
    runButton.disabled = false;
  }
}

runButton.addEventListener('click', () => void run());
