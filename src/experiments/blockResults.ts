// Joins each block with its per-pixel counts: the printed numbers, the SIMD-group grid, and the loop-bound check.
import type { BlockResult } from '../shared/experimentResult';
import { blockStats, overBound, type BlockStats } from './blockStats';
import type { Block } from './findBlocks';

export function blockResults(
  blocks: Block[],
  perPixel: Map<string, Uint32Array>,
  width: number,
  height: number,
): { results: Map<string, BlockResult>; stats: Map<string, BlockStats> } {
  const results = new Map<string, BlockResult>();
  const stats = new Map<string, BlockStats>();
  for (const block of blocks) {
    const counts = perPixel.get(block.id);
    if (!counts) throw new Error(`No counts came back for ${block.id}.`);
    const stat = blockStats(counts, width, height);
    const parent = block.parentId ? perPixel.get(block.parentId) : undefined;
    stats.set(block.id, stat);
    results.set(block.id, {
      id: block.id,
      file: block.file,
      kind: block.kind,
      functionName: block.functionName,
      startLine: block.startLine,
      endLine: block.endLine,
      header: block.header,
      total: stat.total,
      maxPerPixel: stat.maxPerPixel,
      pixelsRan: stat.pixelsRan,
      waitingShare: stat.waitingShare,
      maxPerParent: block.maxPerParent,
      overBoundPixels: block.maxPerParent !== null && parent ? overBound(counts, parent, block.maxPerParent) : null,
    });
  }
  return { results, stats };
}
