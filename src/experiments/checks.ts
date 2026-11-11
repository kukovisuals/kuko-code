// Checks the page runs on its own readings, so a broken counter or timer shows up as a failure instead of a
// wrong picture. Pure, so they can be tested without a GPU.
import type { BlockResult, Check } from '../shared/experimentResult';

// The function the wrapper's main() calls once per pixel.
export const ENTRY_FUNCTION = 'mainImage';

export function countChecks(blocks: BlockResult[], width: number, height: number): Check[] {
  const pixels = width * height;
  const checks: Check[] = [];
  const entry = blocks.find((block) => block.kind === 'function' && block.functionName === ENTRY_FUNCTION);
  checks.push(
    entry
      ? {
          passed: entry.total === pixels && entry.maxPerPixel === 1,
          text: `${ENTRY_FUNCTION} ran ${entry.total.toLocaleString('en-US')} times, at most ${entry.maxPerPixel} per pixel. Expected exactly once for each of the ${pixels.toLocaleString('en-US')} pixels.`,
        }
      : { passed: false, text: `${ENTRY_FUNCTION} was not found in the source.` },
  );
  for (const block of blocks) {
    if (block.maxPerParent === null || block.overBoundPixels === null) continue;
    checks.push({
      passed: block.overBoundPixels === 0,
      text: `The loop at ${block.file} line ${block.startLine} can run at most ${block.maxPerParent} times per run of its enclosing block. Pixels over that: ${block.overBoundPixels}.`,
    });
  }
  return checks;
}

export function timingChecks(run: { disjointReads: number; neverReturned: number; hiddenDuringRun: boolean }): Check[] {
  return [
    { passed: run.disjointReads === 0, text: `GPU_DISJOINT_EXT read true ${run.disjointReads} times.` },
    { passed: run.neverReturned === 0, text: `${run.neverReturned} timer queries never returned.` },
    { passed: !run.hiddenDuringRun, text: run.hiddenDuringRun ? 'The tab was hidden during the run.' : 'The tab stayed visible during the run.' },
  ];
}
