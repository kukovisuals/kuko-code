import { describe, expect, it } from 'vitest';
import hardwareMap from '../data/hardware-map.m2.json';
import { bottleneck, IDLE_PERCENT, SPARE_BLOCK_IDS, spareRoom } from '../src/city/live/spareRoom';
import type { HardwareEvent } from '../src/shared/liveEvents';

const gpu = (devicePercent: number) => ({ devicePercent, rendererPercent: devicePercent, tilerPercent: 5, inUseMemoryBytes: 300 * 1024 * 1024 });

function reading(overrides: Partial<HardwareEvent> = {}): HardwareEvent {
  return {
    type: 'hardware',
    at: 0,
    pCorePercents: [30, 25, 20, 15],
    eCorePercents: [4, 3, 2, 1],
    gpu: gpu(100),
    processes: null,
    loopback: null,
    wifi: { inBytesPerSec: 200, outBytesPerSec: 100, inPacketsPerSec: 1, outPacketsPerSec: 1 },
    flows: [],
    ...overrides,
  };
}

const fill = { gpuMs: 39, budgetMs: 16.67, source: 'test', fill: 1, percent: 234 };

describe('spareRoom', () => {
  it('covers only blocks that are on the hardware map', () => {
    const ids = new Set(hardwareMap.blocks.map((block) => block.id));
    expect(SPARE_BLOCK_IDS.every((id) => ids.has(id))).toBe(true);
  });

  it('gives every block a load or a no-reading reason, and a reach with a reason and a source', () => {
    for (const room of spareRoom(reading())) {
      expect(room.load !== null || Boolean(room.noReading?.trim())).toBe(true);
      expect(['yes', 'indirectly', 'no']).toContain(room.reach);
      expect(room.reason.trim()).not.toBe('');
      expect(room.reasonTag.trim()).not.toBe('');
      expect(room.reasonSource.trim()).not.toBe('');
    }
  });

  it('calls a block idle only from a reading under the line', () => {
    const rooms = new Map(spareRoom(reading()).map((room) => [room.blockId, room]));
    expect(rooms.get('e-cluster')?.load?.value).toBeLessThan(IDLE_PERCENT);
    expect(rooms.get('e-cluster')?.idle).toBe(true);
    expect(rooms.get('p-cluster')?.idle).toBe(false);
    expect(rooms.get('gpu-core')?.idle).toBe(false);
    // 300 bytes a second is under 1 KB/s.
    expect(rooms.get('wifi')?.idle).toBe(true);
  });

  it('never calls a block with no reading idle', () => {
    const rooms = spareRoom(reading({ gpu: null, wifi: null }));
    const unread = rooms.filter((room) => room.load === null);
    expect(unread.map((room) => room.blockId)).toEqual(expect.arrayContaining(['gpu-core', 'neural-engine', 'media-engine', 'slc', 'wifi']));
    expect(unread.every((room) => !room.idle)).toBe(true);
  });

  it('only lets the shader run on the GPU cores', () => {
    const yes = spareRoom(reading()).filter((room) => room.reach === 'yes');
    expect(yes.map((room) => room.blockId)).toEqual(['gpu-core']);
  });
});

describe('bottleneck', () => {
  it('names the GPU when it is full, and prints the frame time against the budget', () => {
    const verdict = bottleneck(reading(), fill, true);
    expect(verdict.part).toBe('gpu');
    expect(verdict.text).toContain('39.00 ms');
    expect(verdict.text).toContain('16.67 ms');
    expect(verdict.text).toContain('whole Mac');
    expect(verdict.text).toContain('misses the budget');
  });

  it('does not call a full GPU late when its frames fit the budget', () => {
    const verdict = bottleneck(reading(), { ...fill, gpuMs: 14.31, fill: 0.86, percent: 86 }, true);
    expect(verdict.part).toBe('gpu');
    expect(verdict.text).toContain('still meets the budget');
  });

  it('names a CPU core when one is full and the GPU is not', () => {
    expect(bottleneck(reading({ gpu: gpu(40), pCorePercents: [95, 10, 10, 10] }), null, true).part).toBe('cpu');
  });

  it('says nothing is full when nothing is', () => {
    expect(bottleneck(reading({ gpu: gpu(40) }), null, true).part).toBe('none');
  });

  it('judges no shader while the program is stopped, even with the GPU full', () => {
    const verdict = bottleneck(reading(), null, false);
    expect(verdict.part).toBe('unknown');
    expect(verdict.text).toContain('stopped');
  });

  it('refuses to name one without a GPU reading', () => {
    expect(bottleneck(reading({ gpu: null }), fill, true).part).toBe('unknown');
  });
});
