// TypeScript mirror of schema/recording.schema.json. The schema is the authority.

export type Status = 'measured' | 'partial' | 'modeled';
export type Basis = 'published' | 'community' | 'this-machine' | 'modeled';
export type CacheState = 'cold' | 'warm' | 'unknown';
export type DisplayLabel = 'built-in' | 'lg' | 'unknown';
export type MetricUnit = 'ms' | 'Hz' | 'count' | 'bytes' | 'percent';

export interface Environment {
  browserMajor: number;
  glRenderer: string;
  timerQueryExposed: boolean;
  parallelCompileExposed: boolean;
  timeElapsedBits: number;
  timestampBits: number;
}

export interface Capture {
  cacheState: CacheState;
  drawingBuffer: { width: number; height: number };
  devicePixelRatio: number;
  display: DisplayLabel;
  warmupFrames: number;
  sampledFrames: number;
  crossOriginIsolated: boolean;
}

export interface ShaderInfo {
  file: string;
  bytes: number;
  sha256: string;
}

export interface SpecNumber {
  name: string;
  value: number;
  unit: string;
  basis: Basis;
  source: string;
}

export interface Block {
  id: string;
  label: string;
  parentId?: string;
  offChip: boolean;
  numbers: SpecNumber[];
}

export interface HardwareMap {
  id: string;
  schematic: true;
  blocks: Block[];
}

export interface Stats {
  n: number;
  min: number;
  median: number;
  p95: number;
  max: number;
}

export interface Metric {
  id: string;
  value: number | null;
  unit: MetricUnit;
  status: Status;
  source: string;
  stats?: Stats;
  note?: string;
}

export interface Stop {
  stop: number;
  name: string;
  blockId: string;
  status: Status;
  metrics: Metric[];
  floors: string[];
}

export interface NativeImport {
  tool: 'instruments' | 'tshark' | 'other';
  stop: number;
  metrics: Metric[];
}

export interface Recording {
  schemaVersion: 1;
  recordedAt: string;
  environment: Environment;
  capture: Capture;
  shader: ShaderInfo;
  hardwareMap: HardwareMap;
  stops: Stop[];
  imports: NativeImport[];
}
