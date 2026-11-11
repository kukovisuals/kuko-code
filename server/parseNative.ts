// Pure parsers for macOS tool output. They pull out named numbers and nothing else, because the raw
// text can hold device identifiers, such as a MAC address in netstat, and must never be forwarded.
import type { GpuStats } from '../src/shared/liveEvents';

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
