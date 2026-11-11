// Pure text for a stop's numbers in the panel. Native imports sit beside browser values, never over them.
import type { NativeImport, Stop } from '../shared/types';

export interface SourcedNumber {
  name: string;
  value: number | null;
  unit: string;
  // A status or a basis. A number can't render without one.
  tag: string;
  source: string;
  native?: boolean;
  // Not a floor of this building. Drawn dimmer in the panel.
  secondary?: boolean;
}

export function formatValue(value: number | null, unit: string): string {
  if (value === null) {
    return 'no value';
  }
  if (unit === 'ms') {
    return `${value.toFixed(2)} ms`;
  }
  return `${value.toLocaleString('en-US')} ${unit}`;
}

export function rowsForStop(stop: Stop, imports: NativeImport[]): SourcedNumber[] {
  const browserRows = stop.metrics.map((metric) => ({
    name: metric.id,
    value: metric.value,
    unit: metric.unit,
    tag: metric.status,
    source: metric.note ? `${metric.source}. ${metric.note}` : metric.source,
    secondary: stop.floors.length > 0 && !stop.floors.includes(metric.id),
  }));
  const nativeRows = imports
    .filter((entry) => entry.stop === stop.stop)
    .flatMap((entry) =>
      entry.metrics.map((metric) => ({
        name: `${entry.tool}: ${metric.id}`,
        value: metric.value,
        unit: metric.unit,
        tag: metric.status,
        source: metric.source,
        native: true,
      })),
    );
  return [...browserRows, ...nativeRows];
}
