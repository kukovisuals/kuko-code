// Runs Day 560 live, times each pass on the GPU, and can measure a cost map. It uses raw WebGL2 and
// never draws the city. Panels repaint twice a second to keep this page's own drawing small.
import { getTimerQueryExt, type TimerQueryExt } from '../record/probeEnvironment';
import { columnAt, drawColumnProfile } from './columnProfile';
import { runCostMap, type CostMapResult } from './costMap';
import { cellAt, drawCostOverlay, overlayRange, rampGradient, type MapView } from './costOverlay';
import { BUFFER, DayRenderer, type FrameInputs } from './dayRenderer';
import { drawBudgetBar, drawFrameStrip } from './frameCharts';
import { LiveHistory, type PassName } from './liveHistory';
import { liveRows, workRows } from './liveRows';
import { loadPasses } from './loadPasses';
import { legendNote, mapRows, mapVerdict } from './mapRows';
import { formatMs, renderRows } from './panelRows';
import { PassTimer } from './passTimer';

const HISTORY_FRAMES = 300;
const WARMUP_FRAMES = 60;
const PANEL_INTERVAL_MS = 500;

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`shader.html is missing #${id}`);
  return node as T;
}

const canvas = byId<HTMLCanvasElement>('canvas');
const overlay = byId<HTMLCanvasElement>('overlay');
const stage = byId<HTMLElement>('stage');
const pauseButton = byId<HTMLButtonElement>('pause');
const mapButton = byId<HTMLButtonElement>('map');
const hint = byId<HTMLElement>('hint');
const readout = byId<HTMLElement>('readout');
const stripCanvas = byId<HTMLCanvasElement>('strip');
const stripReadout = byId<HTMLElement>('strip-readout');
const profileCanvas = byId<HTMLCanvasElement>('profile');
const profileReadout = byId<HTMLElement>('profile-readout');
const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-view]')];

let running = true;
let measuring = false;
let frame = 0;
let startTime = performance.now();
let lastFrameTime = 0;
let lastPanelTime = 0;
let resumed = false;
let mouse: FrameInputs['mouse'] = [0, 0, 0, 0];
let mapResult: CostMapResult | null = null;
let view: MapView = 'picture';
const frameDeltas: number[] = [];
const history = new LiveHistory(HISTORY_FRAMES, WARMUP_FRAMES);

function currentInputs(now: number): FrameInputs {
  return { time: (now - startTime) / 1000, frame, mouse };
}

function renderLivePanels(): void {
  renderRows(byId('live-rows'), liveRows(history, frameDeltas));
  drawBudgetBar(byId('budget'), history.summary((sample) => sample.volume).median, history.summary((sample) => sample.image).median);
  drawFrameStrip(stripCanvas, history.samples, HISTORY_FRAMES);
}

function setView(next: MapView): void {
  view = next;
  for (const button of viewButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
    button.disabled = button.dataset.view !== 'picture' && mapResult === null;
  }
  drawCostOverlay(overlay, mapResult, view);
  byId('legend').hidden = view === 'picture' || mapResult === null;
  readout.textContent = '';
  if (view === 'picture' || !mapResult) return;
  const [low, high] = overlayRange(mapResult, view);
  const isSteps = view === 'steps';
  byId('legend-ramp').style.background = rampGradient();
  byId('legend-low').textContent = isSteps ? `${Math.round(low)} steps` : `${low.toFixed(3)} ms`;
  byId('legend-high').textContent = isSteps ? `${Math.round(high)} steps` : `${high.toFixed(3)} ms`;
  const status = byId('legend-status');
  status.textContent = isSteps ? 'modeled' : 'partial';
  status.className = `status status-${isSteps ? 'modeled' : 'partial'}`;
  byId('legend-note').textContent = legendNote(view, mapResult.rounds);
}

function showMapPanels(result: CostMapResult | null): void {
  byId('map-section').hidden = result === null;
  byId('profile-section').hidden = result === null;
  if (!result) return;
  drawColumnProfile(profileCanvas, result.columnMs, result.controlColumnMs);
  renderRows(byId('map-rows'), mapRows(result));
  byId('map-verdict').textContent = mapVerdict(result);
}

function setRunning(next: boolean): void {
  running = next;
  pauseButton.textContent = running ? 'Pause' : 'Resume';
  hint.textContent = running ? 'Drag the picture to look around.' : 'Paused. Nothing is being drawn or timed.';
}

function pointerToMouse(event: PointerEvent): void {
  const bounds = stage.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * BUFFER.width;
  // The shader's coordinates start at the bottom, the page's at the top.
  const y = (1 - (event.clientY - bounds.top) / bounds.height) * BUFFER.height;
  mouse = [x, y, x, y];
}

function wireMapControls(gl: WebGL2RenderingContext, renderer: DayRenderer, timerExt: TimerQueryExt): void {
  pauseButton.addEventListener('click', () => {
    if (measuring) return;
    if (!running) {
      mapResult = null;
      showMapPanels(null);
      setView('picture');
      resumed = true;
    }
    setRunning(!running);
  });

  mapButton.addEventListener('click', async () => {
    if (measuring) return;
    measuring = true;
    setRunning(false);
    mapButton.disabled = true;
    pauseButton.disabled = true;
    stage.classList.add('measuring');
    mapResult = await runCostMap(gl, timerExt, renderer, currentInputs(lastFrameTime), (step) => {
      hint.textContent = `Measuring ${step}. Keep this tab visible.`;
    });
    stage.classList.remove('measuring');
    showMapPanels(mapResult);
    measuring = false;
    mapButton.disabled = false;
    pauseButton.disabled = false;
    hint.textContent = 'Paused on the measured picture. Resume clears the map.';
    setView('gpu');
  });

  for (const button of viewButtons) {
    button.addEventListener('click', () => setView(button.dataset.view as MapView));
  }
}

function wirePointer(): void {
  stage.addEventListener('pointerdown', (event) => {
    if (!running) return;
    stage.setPointerCapture(event.pointerId);
    pointerToMouse(event);
  });
  stage.addEventListener('pointermove', (event) => {
    if (running && stage.hasPointerCapture(event.pointerId)) {
      pointerToMouse(event);
      return;
    }
    if (!mapResult || view === 'picture') return;
    const bounds = stage.getBoundingClientRect();
    const cell = cellAt(mapResult, event.clientX - bounds.left, event.clientY - bounds.top, bounds.width, bounds.height);
    readout.textContent = `This region: Day 560 ${(mapResult.cellMs[cell] as number).toFixed(3)} ms · control ${(mapResult.controlCellMs[cell] as number).toFixed(3)} ms (partial, GPU timer) · ${Math.round(mapResult.cellSteps[cell] as number)} steps per pixel (modeled)`;
  });
  stage.addEventListener('pointerup', () => renderRows(byId('work-rows'), workRows(mouse)));

  profileCanvas.addEventListener('pointermove', (event) => {
    if (!mapResult) return;
    const column = columnAt(event.clientX - profileCanvas.getBoundingClientRect().left, profileCanvas.clientWidth, mapResult.columnMs.length);
    profileReadout.textContent = `Column ${column + 1} of ${mapResult.columnMs.length}: Day 560 ${formatMs(mapResult.columnMs[column] as number)} · control ${formatMs(mapResult.controlColumnMs[column] as number)} (partial, GPU timer)`;
  });
  profileCanvas.addEventListener('pointerleave', () => {
    profileReadout.textContent = '';
  });

  stripCanvas.addEventListener('pointermove', (event) => {
    const bounds = stripCanvas.getBoundingClientRect();
    const columnsFromRight = Math.floor(((bounds.right - 44 - event.clientX) / (bounds.width - 44)) * HISTORY_FRAMES);
    const sample = history.samples[history.samples.length - 1 - columnsFromRight];
    stripReadout.textContent = sample
      ? `Frame ${sample.frame}: Volume A ${formatMs(sample.volume ?? NaN)} · Image ${formatMs(sample.image ?? NaN)} (partial, GPU timer)`
      : '';
  });
  stripCanvas.addEventListener('pointerleave', () => {
    stripReadout.textContent = '';
  });
}

async function start(): Promise<void> {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false });
  if (!gl) throw new Error('WebGL2 is not available');
  const timerExt = getTimerQueryExt(gl);
  if (!timerExt) throw new Error('EXT_disjoint_timer_query_webgl2 is not exposed, so GPU time can\'t be measured here.');

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  byId('renderer').textContent = String(gl.getParameter(debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER));

  const renderer = new DayRenderer(gl, await loadPasses(gl));
  const timer = new PassTimer<{ frame: number; pass: PassName }>(gl, timerExt, (tag, ms) => history.add(tag.frame, tag.pass, ms));
  wireMapControls(gl, renderer, timerExt);
  wirePointer();
  renderRows(byId('work-rows'), workRows(mouse));
  startTime = performance.now();

  const tick = (now: number) => {
    requestAnimationFrame(tick);
    timer.poll();
    if (now - lastPanelTime > PANEL_INTERVAL_MS) {
      lastPanelTime = now;
      renderLivePanels();
    }
    if (!running) return;
    // The first frame after a pause has no fair delta, so it isn't counted.
    if (lastFrameTime > 0 && !resumed) {
      frameDeltas.push(now - lastFrameTime);
      if (frameDeltas.length > HISTORY_FRAMES) frameDeltas.shift();
    }
    resumed = false;
    lastFrameTime = now;
    const inputs = currentInputs(now);
    const drawn = frame;
    timer.timed({ frame: drawn, pass: 'volume' }, () => renderer.drawVolume(inputs));
    timer.timed({ frame: drawn, pass: 'image' }, () => {
      renderer.prepareImage(inputs);
      renderer.drawImage();
    });
    frame += 1;
  };
  requestAnimationFrame(tick);
}

start().catch((error: unknown) => {
  const box = byId('error');
  box.hidden = false;
  box.textContent = String(error instanceof Error ? error.message : error);
});
