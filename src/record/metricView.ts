// Draws one metric as text: value, stats, status and source. Every later stop reuses it, so no
// number reaches the page without its status and source.
import type { Metric } from '../shared/types';

const fixed = (value: number) => value.toFixed(3);

function line(text: string): HTMLElement {
  const element = document.createElement('div');
  element.textContent = text;
  return element;
}

export function metricView(metric: Metric): HTMLElement {
  const box = document.createElement('section');
  box.className = `metric ${metric.status}`;
  const value = metric.value === null ? 'no value' : `${fixed(metric.value)} ${metric.unit}`;
  box.append(line(`${metric.id}: ${value} (median)`));
  if (metric.stats) {
    const { n, min, median, p95, max } = metric.stats;
    box.append(line(`n ${n}, min ${fixed(min)}, median ${fixed(median)}, p95 ${fixed(p95)}, max ${fixed(max)} ${metric.unit}`));
  }
  box.append(line(`Status: ${metric.status}`));
  box.append(line(`Source: ${metric.source}`));
  if (metric.note) box.append(line(`Note: ${metric.note}`));
  return box;
}
