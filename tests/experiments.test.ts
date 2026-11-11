import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blockStats, overBound } from '../src/experiments/blockStats';
import { countChecks } from '../src/experiments/checks';
import { countingShader, instrument } from '../src/experiments/countingShader';
import { blankComments, findBlocks, loopBound } from '../src/experiments/findBlocks';
import { median, spread } from '../src/experiments/spread';
import { tileGrid } from '../src/experiments/tileTimings';
import { linesNaming } from '../src/shared/translatedText';
import type { BlockResult } from '../src/shared/experimentResult';

const read = (name: string) => readFileSync(new URL(`../shaders/${name}.glsl`, import.meta.url), 'utf8');
const image = read('day442-image');
const common = read('day442-common');
const imageBlocks = findBlocks('image', image);
const commonBlocks = findBlocks('common', common);

const blockAt = (line: number) => imageBlocks.blocks.find((block) => block.startLine === line);
const blockOfLine = (line: number) => imageBlocks.blocks.find((block) => block.id === imageBlocks.lineBlock[line - 1]);

describe('findBlocks on the real Day 442 files', () => {
  it('keeps every index when blanking comments', () => {
    const text = 'a // { x\nb /* { \n } */ c';
    const blank = blankComments(text);
    expect(blank.length).toBe(text.length);
    expect(blank).not.toContain('{');
    expect(blank.split('\n').length).toBe(text.split('\n').length);
  });

  it('finds the functions and loops with their names and kinds', () => {
    const functions = imageBlocks.blocks.filter((block) => block.kind === 'function').map((block) => block.functionName);
    expect(functions).toEqual(['arrow', 'shape', 'map', 'rayMarch', 'calcNormal', 'setCamera', 'render', 'mainImage']);
    expect(commonBlocks.blocks.map((block) => block.functionName)).toEqual(['r2', 'smin', 'sdLink', 'sdCapsule']);
    expect(blockAt(28)).toMatchObject({ kind: 'for', functionName: 'shape', maxPerParent: 5 });
    expect(blockAt(85)).toMatchObject({ kind: 'for', functionName: 'rayMarch', maxPerParent: 60 });
    expect(blockAt(149)?.kind).toBe('if');
    expect(blockAt(155)?.kind).toBe('else');
  });

  it('multiplies a brace-less loop in front of a loop, and reads AA from its #define', () => {
    const inner = imageBlocks.blocks.find((block) => block.functionName === 'mainImage' && block.kind === 'for');
    expect(inner?.startLine).toBe(199);
    expect(inner?.maxPerParent).toBe(4);
    expect(loopBound('for(int i=0; i<N; i++)', new Map())).toBeNull();
  });

  it('gives each line the block it runs in, and comment lines none', () => {
    expect(blockOfLine(29)?.startLine).toBe(28);
    expect(blockOfLine(35)?.functionName).toBe('shape');
    expect(blockOfLine(35)?.kind).toBe('function');
    expect(blockOfLine(98)?.startLine).toBe(85);
    expect(imageBlocks.lineBlock[1]).toBeNull();
    expect(imageBlocks.lineBlock[8]).toBeNull();
    // A one-line function's line takes its own block.
    expect(commonBlocks.lineBlock[2]).toBe(commonBlocks.blocks[0]?.id);
  });
});

describe('the counting copy', () => {
  it('adds one counter just inside each counted brace and changes nothing else', () => {
    const loop = blockAt(28)!;
    const text = instrument(image, [{ block: loop, slot: 3 }]);
    expect(text.replace(' _k3 += 1u;', '')).toBe(image);
    expect(text.split('\n')[27]).toBe('    { _k3 += 1u;');
  });

  it('writes four counters per output and declares only the outputs it uses', () => {
    const blocks = [...commonBlocks.blocks, ...imageBlocks.blocks].slice(0, 6);
    const shader = countingShader([{ file: 'common', text: common }, { file: 'image', text: image }], blocks, 8);
    expect(shader).toContain('layout(location = 1) out uvec4 _counts1;');
    expect(shader).not.toContain('_counts2');
    expect(shader).toContain('_counts1 = uvec4(_k4, _k5, 0u, 0u);');
    expect(shader).not.toContain('outColor');
  });
});

describe('blockStats', () => {
  it('counts totals, and models lanes waiting per 8 x 4 group', () => {
    // One 8 x 4 group: one pixel ran 10 times, the rest once.
    const counts = new Uint32Array(32).fill(1);
    counts[0] = 10;
    const stats = blockStats(counts, 8, 4);
    expect(stats).toMatchObject({ total: 41, maxPerPixel: 10, pixelsRan: 32 });
    expect(stats.waitingShare).toBeCloseTo(1 - 41 / 320);
    expect(stats.groups.max[0]).toBe(10);
  });

  it('finds pixels over a loop bound', () => {
    expect(overBound(new Uint32Array([60, 241]), new Uint32Array([1, 4]), 60)).toBe(1);
  });
});

describe('checks', () => {
  const entry = { kind: 'function', functionName: 'mainImage', total: 6, maxPerPixel: 1, maxPerParent: null, overBoundPixels: null } as BlockResult;
  it('passes when mainImage ran once per pixel, and fails otherwise', () => {
    expect(countChecks([entry], 3, 2)[0]?.passed).toBe(true);
    expect(countChecks([{ ...entry, total: 7, maxPerPixel: 2 }], 3, 2)[0]?.passed).toBe(false);
  });
});

describe('tiles, spread and translated text', () => {
  it('covers 1280 x 800 with 16 x 10 tiles of 80 pixels', () => {
    const grid = tileGrid(1280, 800, 80);
    expect([grid.columns, grid.rows, grid.tiles.length]).toEqual([16, 10, 160]);
    expect(grid.tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0)).toBe(1280 * 800);
  });

  it('takes a median and a range', () => {
    expect(median([3, 1, 2, 10])).toBe(2.5);
    expect(spread([2, 1, 3])).toEqual({ median: 2, min: 1, max: 3, samples: 3 });
    expect(spread([])).toBeNull();
  });

  it("finds a user function under ANGLE's _u prefix but not inside a longer name", () => {
    expect(linesNaming('float _ushape(float3 p)\nmapped\nx = _umap(p);', 'map')).toEqual([3]);
    expect(linesNaming('float _ushape(float3 p)', 'shape')).toEqual([1]);
  });
});
