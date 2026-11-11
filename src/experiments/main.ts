// Shows how the live program compiles and runs on this Mac: how often each line ran (counted on the GPU), where on
// screen the GPU time went (timed by tile), and the text the compiler produced. Readings only: the page never
// proposes a change. Raw WebGL2, no Three.js, and nothing else animating.
import { getTimerQueryExt, probeEnvironment } from '../record/probeEnvironment';
import { EXPERIMENT_SAVE_PATH, EXPERIMENT_SCHEMA, type BlockResult, type Check, type ExperimentResult } from '../shared/experimentResult';
import { LIVE_PROGRAM } from '../shared/liveProgram';
import { wrapImagePass } from '../shaderView/wrapShadertoy';
import { blockResults } from './blockResults';
import type { BlockStats } from './blockStats';
import { countChecks, timingChecks } from './checks';
import { renderCompiler } from './compilerView';
import { countBlocks } from './countPasses';
import { findBlocks } from './findBlocks';
import { GlProgram } from './glProgram';
import { legendGradient } from './heatmapView';
import { ScreenView } from './screenView';
import { markBlock, renderSource, type ListedFile } from './sourceView';
import { spread } from './spread';
import { runTileTimings, TILE_SIZE, tileGrid, TIMED_ROUNDS, WARMUP_ROUNDS } from './tileTimings';
import { translatedSource } from '../shared/translatedSource';

// Every draw uses this one moment of the animation, so counts and times describe the same picture.
const SCENE_TIME_S = 4;
const EMPTY_SHADER = `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(0.0, 0.0, 0.0, 1.0); }
`;
const SOURCES = {
  counts: 'A counting copy adds one counter per { } block and writes the counts instead of a color; readPixels reads them back. Counted on the GPU.',
  simd: '32 threads per SIMD group (community source: metal-benchmarks). Their 8 x 4 layout on screen is our model.',
  tiles: 'EXT_disjoint_timer_query_webgl2 TIME_ELAPSED_EXT around one scissored draw of the unchanged shader.',
  translated: 'WEBGL_debug_shaders getTranslatedShaderSource on the unchanged fragment shader.',
};

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`experiments.html is missing #${id}`);
  return node as T;
}

async function fetchShader(name: string): Promise<string> {
  const response = await fetch(`/shaders/${name}.glsl`, { cache: 'no-store' });
  const text = await response.text();
  // A missing file can come back as Vite's HTML fallback with status 200, so check the text too.
  if (!response.ok || text.trimStart().startsWith('<')) throw new Error(`Could not load shaders/${name}.glsl. Run with npm run dev.`);
  return text;
}

function renderChecks(list: HTMLElement, checks: Check[], notes: string[]): void {
  list.replaceChildren(
    ...checks.map((check) => {
      const row = document.createElement('li');
      row.className = check.passed ? 'check-ok' : 'check-fail';
      row.textContent = `${check.passed ? 'Pass' : 'Fail'}: ${check.text}`;
      return row;
    }),
    ...notes.map((note) => {
      const row = document.createElement('li');
      row.className = 'muted';
      row.textContent = note;
      return row;
    }),
  );
}

async function save(result: ExperimentResult): Promise<string> {
  try {
    const response = await fetch(EXPERIMENT_SAVE_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) });
    const reply = (await response.json()) as { saved?: string; error?: string };
    return reply.saved ? `Saved to ${reply.saved}.` : `Not saved: ${reply.error ?? response.statusText}.`;
  } catch (error) {
    return `Not saved: ${error instanceof Error ? error.message : String(error)}.`;
  }
}

async function start(): Promise<void> {
  const canvas = byId<HTMLCanvasElement>('canvas');
  document.title = `${LIVE_PROGRAM.name} on the hardware`;
  byId('page-title').textContent = `How ${LIVE_PROGRAM.name} compiles and runs on the M2`;
  const runButton = byId<HTMLButtonElement>('run');
  const progress = byId<HTMLElement>('progress');
  const checksList = byId<HTMLElement>('checks');
  const sourceBox = byId<HTMLElement>('source');
  const tileSummary = byId<HTMLElement>('tile-summary');
  for (const legend of document.querySelectorAll<HTMLElement>('.legend-bar')) legend.style.background = legendGradient();
  const screen = new ScreenView({
    blockMap: byId('block-map'),
    blockTitle: byId('block-title'),
    blockLegend: byId('block-legend'),
    blockReadout: byId('block-readout'),
    tileMap: byId('tile-map'),
    tileLegend: byId('tile-legend'),
    tileReadout: byId('tile-readout'),
  });

  const { width, height } = LIVE_PROGRAM;
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false });
  if (!gl) throw new Error('WebGL2 is not available.');
  const ext = getTimerQueryExt(gl);

  const common = LIVE_PROGRAM.commonFile === null ? null : await fetchShader(LIVE_PROGRAM.commonFile);
  const image = await fetchShader(LIVE_PROGRAM.imageFile);
  const files = [
    ...(common === null ? [] : [{ file: `shaders/${LIVE_PROGRAM.commonFile}.glsl`, text: common }]),
    { file: `shaders/${LIVE_PROGRAM.imageFile}.glsl`, text: image },
  ];
  const listed: ListedFile[] = files.map((file) => ({ ...file, blocks: findBlocks(file.file, file.text) }));
  const blocks = listed.flatMap((file) => file.blocks.blocks);

  // The compiler: the unchanged shader, and the text Chrome translated it into.
  const glsl = wrapImagePass(common ?? '', image);
  const real = new GlProgram(gl, glsl);
  const translated = translatedSource(gl, real.fragment);
  const functions = blocks.filter((block) => block.kind === 'function').map((block) => ({ name: block.functionName, file: block.file, line: block.startLine }));
  renderCompiler(byId('compiler'), glsl, translated, functions);

  // The counts: one counting copy per pass, read back, then the unchanged shader drawn once so the picture shows.
  progress.textContent = 'Counting how often each block runs…';
  const counted = countBlocks(gl, listed, blocks, SCENE_TIME_S, width, height);
  const { results, stats } = blockResults(blocks, counted.perPixel, width, height);
  counted.perPixel.clear();
  gl.viewport(0, 0, width, height);
  real.draw(SCENE_TIME_S, width, height);

  const select = (blockId: string) => {
    const block = results.get(blockId) as BlockResult;
    screen.showBlock(block, stats.get(blockId) as BlockStats);
    markBlock(sourceBox, blockId);
  };
  renderSource(sourceBox, listed, results, width * height, select);
  const blockList = [...results.values()];
  const counts = countChecks(blockList, width, height);
  const countNote = `Counted in ${counted.passes} pass${counted.passes === 1 ? '' : 'es'}, ${counted.outputsPerPass} outputs of 4 counters each. iTime = ${SCENE_TIME_S} s.`;
  renderChecks(checksList, counts, [countNote]);

  if (!ext) {
    progress.textContent = "EXT_disjoint_timer_query_webgl2 is not exposed, so GPU time by tile can't be measured here.";
    return;
  }
  const grid = tileGrid(width, height, TILE_SIZE);
  progress.textContent = `Ready. ${grid.tiles.length} tiles, ${WARMUP_ROUNDS} warmup + ${TIMED_ROUNDS} timed rounds, one round per animation frame.`;
  runButton.disabled = false;

  runButton.addEventListener('click', async () => {
    runButton.disabled = true;
    const seed = Math.floor(Math.random() * 2 ** 31);
    const empty = new GlProgram(gl, EMPTY_SHADER);
    const run = await runTileTimings(gl, ext, real, empty, grid.tiles, SCENE_TIME_S, seed, (round, rounds) => {
      progress.textContent = `Round ${round} of ${rounds}.`;
    });
    empty.dispose();
    // The empty shader drew last in every tile, so the unchanged shader is drawn once more to show the picture.
    real.draw(SCENE_TIME_S, width, height);
    const items = grid.tiles.map((tile) => ({
      column: tile.column,
      row: tile.row,
      x: tile.x,
      y: tile.y,
      width: tile.width,
      height: tile.height,
      ms: spread(run.tileMs[tile.index] ?? []),
      emptyMs: spread(run.emptyMs[tile.index] ?? []),
    }));
    screen.showTiles(items, grid.columns, grid.rows);
    const whole = spread(run.wholeMs);
    const tileSum = items.reduce((sum, tile) => sum + (tile.ms?.median ?? 0), 0);
    const emptyAll = spread(run.emptyMs.flat());
    tileSummary.textContent =
      `Whole screen in one draw: median ${whole ? whole.median.toFixed(2) : '?'} ms, range ${whole ? `${whole.min.toFixed(2)} to ${whole.max.toFixed(2)}` : '?'} ms, ${whole?.samples ?? 0} rounds. ` +
      `Sum of the ${items.length} tile medians: ${tileSum.toFixed(2)} ms. ` +
      `Empty shader in one tile: median ${emptyAll ? emptyAll.median.toFixed(3) : '?'} ms over ${emptyAll?.samples ?? 0} draws.`;

    const checks = [...counts, ...timingChecks(run)];
    const result: ExperimentResult = {
      schema: EXPERIMENT_SCHEMA,
      savedAt: new Date().toISOString(),
      program: LIVE_PROGRAM.name,
      width,
      height,
      sceneTimeS: SCENE_TIME_S,
      sources: SOURCES,
      counting: { passes: counted.passes, outputsPerPass: counted.outputsPerPass, blocks: blockList },
      tiles: { size: TILE_SIZE, columns: grid.columns, rows: grid.rows, warmupRounds: WARMUP_ROUNDS, timedRounds: TIMED_ROUNDS, seed, items, wholeFrameMs: whole },
      translated: {
        available: translated !== null,
        language: translated?.language ?? null,
        glsl: { bytes: new TextEncoder().encode(glsl).length, lines: glsl.split('\n').length },
        text: translated?.text ?? null,
      },
      environment: probeEnvironment(gl),
      crossOriginIsolated: self.crossOriginIsolated,
      disjointReads: run.disjointReads,
      neverReturned: run.neverReturned,
      hiddenDuringRun: run.hiddenDuringRun,
      runSeconds: run.runSeconds,
      checks,
    };
    const saved = await save(result);
    renderChecks(checksList, checks, [countNote, `Timing run: ${run.runSeconds.toFixed(1)} s. Seed ${seed}.`, saved]);
    progress.textContent = 'Done. Press again to time another run.';
    runButton.disabled = false;
  });
}

start().catch((error: unknown) => {
  const box = byId<HTMLElement>('error');
  box.hidden = false;
  box.textContent = error instanceof Error ? error.message : String(error);
});
