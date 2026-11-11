// Pure parsers for macOS tool output. They pull out named numbers and nothing else, because the raw
// text can hold device identifiers, such as a MAC address in netstat, and must never be forwarded.
import type { GpuStats } from '../src/shared/liveEvents';

export type ProcessKind = 'chrome-renderer' | 'chrome-gpu';

function numberAfter(text: string, key: string): number | null {
  const match = new RegExp(`"${key}"=(\\d+)`).exec(text);
  return match ? Number(match[1]) : null;
}

// From: ioreg -r -d 1 -w 0 -c IOAccelerator
export function parseGpuStats(text: string): GpuStats | null {
  const devicePercent = numberAfter(text, 'Device Utilization %');
  const rendererPercent = numberAfter(text, 'Renderer Utilization %');
  const tilerPercent = numberAfter(text, 'Tiler Utilization %');
  const inUseMemoryBytes = numberAfter(text, 'In use system memory');
  if (devicePercent === null || rendererPercent === null || tilerPercent === null || inUseMemoryBytes === null) {
    return null;
  }
  return { devicePercent, rendererPercent, tilerPercent, inUseMemoryBytes };
}

export interface InterfaceCounters {
  inPackets: number;
  inBytes: number;
  outPackets: number;
  outBytes: number;
}

// From: netstat -ibn. Columns are read from the right, because only some rows have an address column.
export function parseInterfaceCounters(text: string, name: string): InterfaceCounters | null {
  const row = text.split('\n').find((line) => line.startsWith(`${name} `) && line.includes('<Link#'));
  if (!row) {
    return null;
  }
  const fields = row.trim().split(/\s+/).map(Number);
  const at = (fromEnd: number) => fields[fields.length - fromEnd] as number;
  const counters = { inPackets: at(7), inBytes: at(5), outPackets: at(4), outBytes: at(2) };
  return Object.values(counters).every(Number.isFinite) ? counters : null;
}

export interface FlowTotal {
  clientPort: number;
  inBytes: number;
  outBytes: number;
}

// From: nettop -L 1 -m tcp -n -x -J bytes_in,bytes_out,state. Keeps only the dev server's side of its
// loopback connections, so remote addresses and other apps' connections are never read.
export function parseLoopbackFlows(text: string, serverPort: number): FlowTotal[] {
  const pattern = new RegExp(`^tcp[46] (?:::1|127\\.0\\.0\\.1)[.:]${serverPort}<->(?:::1|127\\.0\\.0\\.1)[.:](\\d+),[^,]*,(\\d+),(\\d+),`);
  return text.split('\n').flatMap((line) => {
    const match = pattern.exec(line);
    return match ? [{ clientPort: Number(match[1]), inBytes: Number(match[2]), outBytes: Number(match[3]) }] : [];
  });
}

export interface ProcessTime {
  // Only used on the server, to match a process with itself in the next sample. It is never forwarded.
  pid: number;
  kind: ProcessKind;
  cpuSeconds: number;
}

const CHROME_KINDS: Record<string, ProcessKind> = { renderer: 'chrome-renderer', 'gpu-process': 'chrome-gpu' };

// ps prints CPU time as minutes:seconds.hundredths, with hours and days in front on long-lived processes.
function cpuTimeSeconds(text: string): number {
  const [days, clock] = text.includes('-') ? (text.split('-') as [string, string]) : ['0', text];
  return clock.split(':').reduce((total, part) => total * 60 + Number(part), 0) + Number(days) * 86400;
}

// From: ps -axo pid=,time=,command=. The command line holds paths and flags, so only Chrome's own
// process type is read from it. Other Electron apps use the same --type flags and are skipped.
export function parseProcessTimes(text: string): ProcessTime[] {
  return text.split('\n').flatMap((line) => {
    const match = /^\s*(\d+)\s+([\d:.-]+)\s+(.*)$/.exec(line);
    const type = match && match[3]?.includes('Google Chrome') ? /--type=(renderer|gpu-process)(?:\s|$)/.exec(match[3]) : null;
    if (!match || !type) {
      return [];
    }
    const cpuSeconds = cpuTimeSeconds(match[2] as string);
    return Number.isFinite(cpuSeconds) ? [{ pid: Number(match[1]), kind: CHROME_KINDS[type[1] as string] as ProcessKind, cpuSeconds }] : [];
  });
}
