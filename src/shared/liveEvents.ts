// What the live view passes around. Feed events come from the dev server, and program events come from
// the embedded program frame. Times are milliseconds since the Unix epoch, all from this one Mac.
import type { Environment } from './types';

export interface HttpEvent {
  type: 'http';
  at: number;
  method: string;
  path: string;
  status: number;
  // Bytes written to the socket for this response, headers included.
  bytes: number;
  serverMs: number;
  serverPort: number;
  clientPort: number;
}

export interface GpuStats {
  devicePercent: number;
  rendererPercent: number;
  tilerPercent: number;
  inUseMemoryBytes: number;
}

export interface InterfaceRate {
  inBytesPerSec: number;
  outBytesPerSec: number;
  inPacketsPerSec: number;
  outPacketsPerSec: number;
}

export interface FlowDelta {
  serverPort: number;
  clientPort: number;
  // Bytes this connection moved since the last sample, as seen from the dev server.
  inBytes: number;
  outBytes: number;
  // True for the connection carrying this feed, so the table can say it is watching itself.
  isThisFeed: boolean;
}

export interface HardwareEvent {
  type: 'hardware';
  at: number;
  eCorePercents: number[];
  pCorePercents: number[];
  gpu: GpuStats | null;
  loopback: InterfaceRate | null;
  wifi: InterfaceRate | null;
  flows: FlowDelta[];
}

export type FeedEvent = HttpEvent | HardwareEvent;

export type ProgramEvent =
  | { type: 'env'; at: number; environment: Environment; width: number; height: number; devicePixelRatio: number; crossOriginIsolated: boolean }
  | { type: 'fetch'; at: number; file: string; ms: number; bytes: number }
  | { type: 'source'; at: number; bytes: number; sha256: string }
  | { type: 'compile'; at: number; callsMs: number; compileMs: number }
  | { type: 'link'; at: number; callsMs: number; linkMs: number }
  | { type: 'round-trip'; at: number; ms: number }
  | { type: 'first-draw'; at: number; ms: number }
  | { type: 'steady-draw'; at: number; ms: number }
  | { type: 'frame'; at: number; frame: number; callsMs: number; deltaMs: number | null; gpuMs: number }
  | { type: 'error'; at: number; message: string };

export const PROGRAM_MESSAGE = 'live-program';

export interface ProgramMessage {
  channel: typeof PROGRAM_MESSAGE;
  event: ProgramEvent;
}
