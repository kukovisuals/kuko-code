// What the live view passes around. Feed events come from the dev server, and program events come from
// the embedded program frame. Times are milliseconds since the Unix epoch, all from this one Mac.
import type { TranslatedLanguage } from './translatedText';
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

// CPU time each process used during the sample, as a share of one core: 100 means one core busy throughout.
export interface ProcessLoads {
  nodePercent: number;
  // Null when ps shows no Chrome GPU process.
  gpuProcessPercent: number | null;
  // ps can't say which renderer is this tab, so all of Chrome's are added up, and the busiest is kept.
  rendererCount: number;
  renderersPercent: number;
  busiestRendererPercent: number;
}

// One shader file read from disk by the dev server, to answer a request.
export interface FileReadEvent {
  type: 'file-read';
  at: number;
  file: string;
  bytes: number;
  ms: number;
}

export interface HardwareEvent {
  type: 'hardware';
  at: number;
  eCorePercents: number[];
  pCorePercents: number[];
  gpu: GpuStats | null;
  // Null on the first sample, which only sets the baseline, and when ps fails.
  processes: ProcessLoads | null;
  loopback: InterfaceRate | null;
  wifi: InterfaceRate | null;
  flows: FlowDelta[];
}

export type FeedEvent = HttpEvent | HardwareEvent | FileReadEvent;

export type ProgramEvent =
  | { type: 'env'; at: number; environment: Environment; width: number; height: number; devicePixelRatio: number; crossOriginIsolated: boolean }
  | { type: 'fetch'; at: number; file: string; ms: number; bytes: number }
  | { type: 'source'; at: number; bytes: number; sha256: string }
  | { type: 'compile'; at: number; callsMs: number; compileMs: number }
  | { type: 'link'; at: number; callsMs: number; linkMs: number }
  // The fragment GLSL exactly as handed to gl.shaderSource(), and the text WEBGL_debug_shaders returned for it.
  // Text is null when the extension isn't exposed.
  | { type: 'translated'; at: number; glsl: string; text: string | null; language: TranslatedLanguage | null }
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
