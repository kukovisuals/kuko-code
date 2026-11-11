// The screen panel: where the selected block ran (measured counts, grouped as modeled SIMD groups), and GPU
// time by tile (partial). Pointing at either map prints that cell's numbers.
import type { BlockResult, TileResult } from '../shared/experimentResult';
import { GROUP_HEIGHT, GROUP_WIDTH, type BlockStats } from './blockStats';
import { cellAt, drawHeatmap } from './heatmapView';

const ms = (value: number) => `${value.toFixed(3)} ms`;

export interface ScreenElements {
  blockMap: HTMLCanvasElement;
  blockTitle: HTMLElement;
  blockLegend: HTMLElement;
  blockReadout: HTMLElement;
  tileMap: HTMLCanvasElement;
  tileLegend: HTMLElement;
  tileReadout: HTMLElement;
}

export class ScreenView {
  private stats: BlockStats | null = null;
  private tiles: { items: TileResult[]; columns: number; rows: number } | null = null;

  constructor(private view: ScreenElements) {
    view.blockMap.addEventListener('mousemove', (event) => this.readBlock(event));
    view.tileMap.addEventListener('mousemove', (event) => this.readTile(event));
  }

  showBlock(block: BlockResult, stats: BlockStats): void {
    this.stats = stats;
    const { groups } = stats;
    let high = 0;
    for (const value of groups.mean) if (value > high) high = value;
    drawHeatmap(this.view.blockMap, groups.mean, groups.columns, groups.rows, 0, high);
    this.view.blockTitle.textContent = `${block.functionName}, ${block.kind} block, ${block.file} lines ${block.startLine} to ${block.endLine}`;
    this.view.blockLegend.textContent = `0 to ${high.toFixed(2)} runs per pixel, averaged over each ${GROUP_WIDTH} x ${GROUP_HEIGHT} group`;
    this.view.blockReadout.textContent = 'Point at the map to read one group.';
  }

  showTiles(items: TileResult[], columns: number, rows: number): void {
    this.tiles = { items, columns, rows };
    const medians = items.map((tile) => tile.ms?.median ?? 0);
    const positive = medians.filter((value) => value > 0);
    const low = Math.min(...positive);
    const high = Math.max(...positive);
    drawHeatmap(this.view.tileMap, medians, columns, rows, low, high);
    this.view.tileLegend.textContent = `${ms(low)} to ${ms(high)} median per tile draw`;
    this.view.tileReadout.textContent = 'Point at the map to read one tile.';
  }

  private readBlock(event: MouseEvent): void {
    if (!this.stats) return;
    const { groups } = this.stats;
    const { column, row } = cellAt(this.view.blockMap, event, groups.columns, groups.rows);
    const index = row * groups.columns + column;
    const x = column * GROUP_WIDTH;
    const y = row * GROUP_HEIGHT;
    this.view.blockReadout.textContent =
      `Pixels x ${x} to ${x + GROUP_WIDTH - 1}, y ${y} to ${y + GROUP_HEIGHT - 1} (one modeled SIMD group): ` +
      `mean ${(groups.mean[index] as number).toFixed(2)}, busiest pixel ${groups.max[index]} runs.`;
  }

  private readTile(event: MouseEvent): void {
    if (!this.tiles) return;
    const { column, row } = cellAt(this.view.tileMap, event, this.tiles.columns, this.tiles.rows);
    const tile = this.tiles.items.find((item) => item.column === column && item.row === row);
    if (!tile?.ms) return;
    const empty = tile.emptyMs ? ` Empty shader in the same tile: ${ms(tile.emptyMs.median)}.` : '';
    this.view.tileReadout.textContent =
      `Tile x ${tile.x} to ${tile.x + tile.width - 1}, y ${tile.y} to ${tile.y + tile.height - 1}: median ${ms(tile.ms.median)}, ` +
      `range ${ms(tile.ms.min)} to ${ms(tile.ms.max)}, ${tile.ms.samples} rounds.${empty}`;
  }
}
