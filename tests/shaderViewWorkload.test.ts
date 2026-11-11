import { describe, expect, it } from 'vitest';
import { columnMedians, gridRegions } from '../src/shaderView/costMap';
import { correlation, median, percentile, rankCorrelation } from '../src/shaderView/numbers';
import { marchSteps, stepsPerCell, volumeWorkload } from '../src/shaderView/workload';
import { wrapImagePass, wrapVolumePass } from '../src/shaderView/wrapShadertoy';

const NO_MOUSE = [0, 0, 0, 0] as const;

describe('marchSteps', () => {
  it('takes 200 steps down the center, the full 2 units through the cube', () => {
    expect(marchSteps(640, 400, 1280, 800, NO_MOUSE)).toBeCloseTo(200, -1);
  });

  it('is longest where rays reach the far corners, and shorter at the screen edge', () => {
    const center = marchSteps(640, 400, 1280, 800, NO_MOUSE);
    // At 1280 x 800, x = 1040 and y = 799 give a direction of about (0.5, 0.5, -1).
    const farCorner = marchSteps(1040, 799, 1280, 800, NO_MOUSE);
    const screenCorner = marchSteps(1279, 799, 1280, 800, NO_MOUSE);
    expect(farCorner).toBeGreaterThan(center);
    expect(screenCorner).toBeLessThan(farCorner);
  });

  it('ignores a mouse position too close to the corner, as the shader does', () => {
    const atRest = marchSteps(100, 100, 1280, 800, NO_MOUSE);
    expect(marchSteps(100, 100, 1280, 800, [3, 3, 0, 0])).toBe(atRest);
  });
});

describe('stepsPerCell', () => {
  it('returns one value per grid cell', () => {
    expect(stepsPerCell(1280, 800, { columns: 16, rows: 10 }, NO_MOUSE)).toHaveLength(160);
  });

  it('is left-right symmetric when the mouse is at rest', () => {
    const cells = stepsPerCell(1280, 800, { columns: 4, rows: 2 }, NO_MOUSE);
    expect(cells[0]).toBeCloseTo(cells[3] as number, 0);
  });
});

describe('volumeWorkload', () => {
  it('counts every voxel, and only the ones past the early return as active', () => {
    const work = volumeWorkload(128);
    expect(work.voxels).toBe(2_097_152);
    expect(work.activeVoxels).toBe(118 * 118 * 122);
    expect(work.texelFetches).toBe(118 * 118 * 122 * 7);
    expect(work.renderTargets).toBe(128);
  });
});

describe('numbers', () => {
  it('takes medians of odd and even lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it('takes a percentile from the sorted list', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBe(10);
  });

  it('gives 1 for lists that rise together and -1 for opposite lists', () => {
    expect(correlation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(correlation([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
  });

  it('keeps a rising trend visible through a spike, which plain correlation loses', () => {
    const steps = [1, 2, 3, 4, 5, 6];
    const withSpike = [1, 2, 3, 4, 5, 500];
    expect(rankCorrelation(withSpike, steps)).toBeCloseTo(1);
    expect(correlation(withSpike, steps)).toBeLessThan(0.75);
  });

  it('shares ranks between tied values', () => {
    expect(rankCorrelation([1, 1, 2], [1, 1, 2])).toBeCloseTo(1);
  });
});

describe('cost map grid', () => {
  it('covers the whole buffer with no gaps', () => {
    const regions = gridRegions({ columns: 16, rows: 10 }, 1280, 800);
    expect(regions).toHaveLength(160);
    expect(regions.reduce((sum, [, , width, height]) => sum + width * height, 0)).toBe(1280 * 800);
  });

  it('starts at the bottom left, as gl.scissor does', () => {
    expect(gridRegions({ columns: 16, rows: 10 }, 1280, 800)[0]).toEqual([0, 0, 80, 80]);
  });

  it('takes each column median, so one spiking region does not move it', () => {
    expect(columnMedians([1, 2, 1, 2, 99, 2], { columns: 2, rows: 3 })).toEqual([1, 2]);
  });
});

describe('wrappers', () => {
  it('puts #version on the first line, which GLSL requires', () => {
    expect(wrapImagePass('', 'x').startsWith('#version 300 es\n')).toBe(true);
    expect(wrapVolumePass('', 'x').startsWith('#version 300 es\n')).toBe(true);
  });

  it('gives each pass its own entry point', () => {
    expect(wrapImagePass('', '')).toContain('mainImage(color, gl_FragCoord.xy)');
    expect(wrapVolumePass('', '')).toContain('mainVolume(color, vec3(gl_FragCoord.xy, uSlice + 0.5))');
  });
});
