// Pure: where the three processes are drawn on the CPU district, and which stops run inside each.
// A zone is a process, not a core. macOS moves a process's threads between cores, so zones sit on
// the district floor and never on a core tile.
import type { Rect } from './layoutMap';

export type ProcessId = 'renderer' | 'node' | 'gpu-process';

export interface ProcessZone {
  id: ProcessId;
  name: string;
  rect: Rect;
  stops: number[];
}

export const PROCESS_ZONES: ProcessZone[] = [
  { id: 'renderer', name: 'Chrome renderer', rect: { x: -42.6, z: -7.6, w: 9.2, d: 8.2 }, stops: [2, 3] },
  { id: 'node', name: 'Node (dev server)', rect: { x: -32.4, z: -7.6, w: 8.8, d: 8.2 }, stops: [] },
  { id: 'gpu-process', name: 'Chrome GPU process', rect: { x: -22.6, z: -7.6, w: 19.2, d: 8.2 }, stops: [4, 5] },
];
