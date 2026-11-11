// Temporary page for T04 to T06. It reports what the browser exposes, checks the reference shaders,
// and runs the GPU timing experiment. Nothing else animates here, and it never saves a recording.
import { probeEnvironment } from '../record/probeEnvironment';
import { prepare, runCadence, runReadPixels, runTimerQuery } from './gpuTimingRuns';
import { buildProgram, fetchShader, type FetchedShader } from './shaderProgram';

const SHADER_NAMES = ['trivial', 'cost-low', 'cost-mid', 'cost-high'];
const COSTS = ['cost-low', 'cost-mid', 'cost-high'];
const FULL = { width: 1280, height: 800 };
const QUARTER = { width: 640, height: 400 };
const WARMUP = 60;
const SAMPLES = 300;

const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
const status = document.querySelector<HTMLElement>('#status');
const output = document.querySelector<HTMLElement>('#results');
const runButton = document.querySelector<HTMLButtonElement>('#run');
if (!canvas || !status || !output || !runButton) throw new Error('probe.html is missing an element');

const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false });
if (!gl) throw new Error('WebGL2 is not available');
const context = gl;

let hiddenDuringRun = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenDuringRun = true;
});

const report: Record<string, unknown> = {};

function show(message: string): void {
  (status as HTMLElement).textContent = message;
  (output as HTMLElement).textContent = JSON.stringify(report, null, 2);
}

function checkShader(shader: FetchedShader): Record<string, unknown> {
  try {
    buildProgram(context, shader.source);
    return { file: shader.name, isRawGlsl: shader.isRawGlsl, cacheControl: shader.cacheControl, compiled: true };
  } catch (error) {
    return { file: shader.name, isRawGlsl: shader.isRawGlsl, cacheControl: shader.cacheControl, compiled: false, log: String(error) };
  }
}

async function runExperiment(shaders: Map<string, FetchedShader>): Promise<void> {
  const programOf = (name: string) => buildProgram(context, (shaders.get(name) as FetchedShader).source);
  hiddenDuringRun = false;
  const timing: Record<string, unknown> = {};
  report.timing = timing;

  for (const name of COSTS) {
    show(`Timer query: ${name} at 1280 x 800`);
    const program = programOf(name);
    prepare(context, program, FULL.width, FULL.height);
    timing[`query ${name} 1280x800`] = await runTimerQuery(context, program, WARMUP, SAMPLES);
  }

  show('Timer query: cost-mid at 640 x 400');
  const mid = programOf('cost-mid');
  prepare(context, mid, QUARTER.width, QUARTER.height);
  timing['query cost-mid 640x400'] = await runTimerQuery(context, mid, WARMUP, SAMPLES);

  for (const name of COSTS) {
    show(`readPixels wall clock: ${name} at 1280 x 800`);
    const program = programOf(name);
    prepare(context, program, FULL.width, FULL.height);
    timing[`readPixels ${name} 1280x800`] = await runReadPixels(context, program, 30, 120);
  }

  // Alternating off and on keeps slow drift, such as heat, from looking like a query effect.
  prepare(context, mid, FULL.width, FULL.height);
  const cadence = [];
  for (const queryOn of [false, true, false, true]) {
    show(`Cadence with the query ${queryOn ? 'on' : 'off'}`);
    cadence.push(await runCadence(context, mid, queryOn, 30, 180));
  }
  timing.cadence = cadence;

  report.tabStayedVisible = !hiddenDuringRun;
  show(hiddenDuringRun ? 'Done, but the tab was hidden during the run: results are not valid.' : 'Done.');
}

async function start(): Promise<void> {
  report.environment = probeEnvironment(context);
  report.crossOriginIsolated = self.crossOriginIsolated;
  report.devicePixelRatio = devicePixelRatio;
  report.antialias = context.getContextAttributes()?.antialias;
  const fetched = await Promise.all(SHADER_NAMES.map(fetchShader));
  report.shaderCheck = fetched.map(checkShader);
  show('Environment and shader check done. Press the button to run the experiment.');

  const shaders = new Map(fetched.map((shader) => [shader.name, shader]));
  const button = runButton as HTMLButtonElement;
  button.disabled = false;
  button.addEventListener('click', () => {
    button.disabled = true;
    runExperiment(shaders)
      .catch((error: unknown) => show(`Failed: ${String(error)}`))
      .finally(() => {
        button.disabled = false;
      });
  });
}

start().catch((error: unknown) => show(`Failed: ${String(error)}`));
