import { describe, expect, it } from 'vitest';
import hardwareMap from '../data/hardware-map.m2.json';
import { layoutGpuCores, layoutMap, rectContains, rectsOverlap, siteForStop } from '../src/city/layoutMap';

const ids = hardwareMap.blocks.map((block) => block.id);
const placed = layoutMap(ids);
const byId = new Map(placed.map((block) => [block.id, block]));

function isAncestor(ancestorId: string, id: string): boolean {
  const within = byId.get(id)?.within;
  if (!within) {
    return false;
  }
  return within === ancestorId || isAncestor(ancestorId, within);
}

describe('layoutMap', () => {
  it('places every block in the hardware map', () => {
    expect(placed.map((block) => block.id).sort()).toEqual([...ids].sort());
  });

  it('throws for a block with no slot', () => {
    expect(() => layoutMap(['mystery'])).toThrow('no slot');
  });

  it('has no unintended overlaps', () => {
    const clashes: string[] = [];
    for (const a of placed) {
      for (const b of placed) {
        const related = a.id === b.id || isAncestor(a.id, b.id) || isAncestor(b.id, a.id);
        if (!related && rectsOverlap(a, b)) {
          clashes.push(`${a.id} overlaps ${b.id}`);
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  it('keeps every child inside the block it is drawn within', () => {
    for (const block of placed) {
      if (block.within) {
        expect(rectContains(byId.get(block.within)!, block), block.id).toBe(true);
      }
    }
  });

  it('matches the parent ids in the hardware map', () => {
    for (const block of hardwareMap.blocks.filter((entry) => 'parentId' in entry)) {
      expect(isAncestor(block.parentId as string, block.id), block.id).toBe(true);
    }
  });

  it('lays out 10 non-overlapping GPU cores inside their area', () => {
    const area = byId.get('gpu-core')!;
    const cores = layoutGpuCores(area, 10);
    expect(cores).toHaveLength(10);
    cores.forEach((core, index) => {
      expect(rectContains(area, core)).toBe(true);
      cores.slice(index + 1).forEach((other) => expect(rectsOverlap(core, other)).toBe(false));
    });
  });

  it('puts each stop site on its hardware block', () => {
    const expected: Array<[number, string]> = [
      [1, 'network-road'],
      [2, 'cpu'],
      [3, 'cpu'],
      [4, 'cpu'],
      [5, 'cpu'],
      [6, 'gpu'],
      [7, 'gpu'],
      [8, 'display-engines'],
    ];
    for (const [stop, blockId] of expected) {
      expect(rectContains(byId.get(blockId)!, siteForStop(stop)), `stop ${stop}`).toBe(true);
    }
  });
});
