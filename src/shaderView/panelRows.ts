// Builds the right rail's rows. A row can't render a value without a status and a source.
import type { Status } from '../shared/types';

export interface PanelRow {
  label: string;
  value: string;
  status: Status;
  source: string;
}

function element(tag: string, className: string, text = ''): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function renderRow(row: PanelRow): HTMLElement {
  const container = element('div', 'row');
  const top = element('div', 'row-top');
  top.append(element('span', 'row-label', row.label), element('span', 'row-value', row.value));
  container.append(top, element('span', `status status-${row.status}`, row.status), element('p', 'row-source', row.source));
  return container;
}

export function renderRows(target: HTMLElement, rows: readonly PanelRow[]): void {
  target.replaceChildren(...rows.map(renderRow));
}

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return 'waiting';
  return `${ms.toFixed(2)} ms`;
}

export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} million`;
  return Math.round(value).toLocaleString('en-US');
}
