// The user's Common and Image text, line by line, each line with the counts of the block it runs in.
// Lines in one block run together, so they share its numbers. Clicking a line selects its block.
import type { BlockResult } from '../shared/experimentResult';
import type { FileBlocks } from './findBlocks';

export interface ListedFile {
  file: string;
  text: string;
  blocks: FileBlocks;
}

const whole = (value: number) => value.toLocaleString('en-US');
const percent = (share: number) => `${(share * 100).toFixed(1)}%`;

function cell(className: string, text: string): HTMLElement {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  return node;
}

function headingRow(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'source-line source-head';
  row.append(
    cell('gutter', 'line'),
    cell('num', 'runs / frame'),
    cell('num', 'max / pixel'),
    cell('num', 'pixels'),
    cell('num modeled', 'lanes waiting'),
    cell('code', 'code'),
  );
  return row;
}

export function renderSource(
  container: HTMLElement,
  files: ListedFile[],
  results: Map<string, BlockResult> | null,
  pixels: number,
  onSelect: (blockId: string) => void,
): void {
  container.replaceChildren(headingRow());
  const largest = results ? Math.max(1, ...[...results.values()].map((block) => block.total)) : 1;
  for (const { file, text, blocks } of files) {
    container.append(cell('source-file', file));
    text.split('\n').forEach((code, index) => {
      const blockId = blocks.lineBlock[index] ?? null;
      const block = blockId ? results?.get(blockId) : undefined;
      const row = document.createElement('div');
      row.className = 'source-line';
      row.dataset.file = file;
      row.dataset.line = String(index + 1);
      if (blockId) row.dataset.block = blockId;
      const bar = cell('num runs', block ? whole(block.total) : '');
      if (block) bar.style.setProperty('--share', String(block.total / largest));
      row.append(
        cell('gutter', String(index + 1)),
        bar,
        cell('num', block ? whole(block.maxPerPixel) : ''),
        cell('num', block ? percent(block.pixelsRan / pixels) : ''),
        cell('num modeled', block?.waitingShare != null ? percent(block.waitingShare) : ''),
        cell('code', code || ' '),
      );
      if (blockId) row.addEventListener('click', () => onSelect(blockId));
      container.append(row);
    });
  }
}

// Marks every line that runs in the chosen block, and scrolls the listing (not the page) to its first line.
export function markBlock(container: HTMLElement, blockId: string | null): void {
  let first: HTMLElement | null = null;
  container.querySelectorAll<HTMLElement>('.source-line[data-line]').forEach((row) => {
    const on = blockId !== null && row.dataset.block === blockId;
    row.classList.toggle('selected', on);
    if (on) first ??= row;
  });
  const target = first as HTMLElement | null;
  if (target && (target.offsetTop < container.scrollTop || target.offsetTop > container.scrollTop + container.clientHeight - 40)) {
    container.scrollTo({ top: target.offsetTop - 60, behavior: 'smooth' });
  }
}
