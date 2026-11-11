// Pure: turns each real event into one row of the capture table, always with a status and a source.
import type { HttpEvent, FlowDelta, InterfaceRate, ProgramEvent } from '../../shared/liveEvents';
import { LIVE_PROGRAM } from '../../shared/liveProgram';
import type { Status } from '../../shared/types';

export type WireGroup = 'http' | 'tcp' | 'feed' | 'build' | 'frame' | 'net';

export interface WireRow {
  at: number;
  group: WireGroup;
  from: string;
  to: string;
  protocol: string;
  length: string;
  info: string;
  status: Status;
  source: string;
  component?: string;
}

const LIVE_NOTE = `Embedded ${LIVE_PROGRAM.name} frame, with the city drawing beside it.`;
const WHOLE_MAC = 'whole Mac, not only this app';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function httpRow(event: HttpEvent): WireRow {
  return {
    at: event.at,
    group: 'http',
    from: `Dev server :${event.serverPort}`,
    to: `Chrome :${event.clientPort}`,
    protocol: 'HTTP',
    length: formatBytes(event.bytes),
    info: `${event.method} ${event.path} ${event.status}, ${event.serverMs.toFixed(1)} ms on server`,
    status: 'partial',
    source: 'Seen by the Vite dev server: bytes written to the socket, headers included. Time is on the server, not on the wire.',
    component: 'dev-server',
  };
}

export function flowRow(flow: FlowDelta, at: number): WireRow {
  const parts = [`${formatBytes(flow.outBytes)} to Chrome`, `${formatBytes(flow.inBytes)} from Chrome`];
  return {
    at,
    // The live feed itself never stops, so it has its own filter and starts hidden.
    group: flow.isThisFeed ? 'feed' : 'tcp',
    from: `:${flow.serverPort}`,
    to: `:${flow.clientPort}`,
    protocol: 'TCP',
    length: formatBytes(flow.inBytes + flow.outBytes),
    info: flow.isThisFeed ? `${parts.join(', ')}, live feed to a city tab` : parts.join(', '),
    status: 'partial',
    source: 'nettop, no root needed: bytes per connection since the last sample. Not individual packets, which need root to capture.',
    component: 'network-road',
  };
}

export function interfaceRow(name: 'lo0' | 'Wi-Fi', rate: InterfaceRate, at: number): WireRow {
  const packets = rate.inPacketsPerSec + rate.outPacketsPerSec;
  return {
    at,
    group: 'net',
    from: name,
    to: 'all apps',
    protocol: name === 'Wi-Fi' ? 'Wi-Fi' : 'LOOP',
    length: `${formatBytes(rate.inBytesPerSec + rate.outBytesPerSec)}/s`,
    info: `in ${formatBytes(rate.inBytesPerSec)}/s, out ${formatBytes(rate.outBytesPerSec)}/s, ${Math.round(packets)} packets/s, ${WHOLE_MAC}`,
    status: 'partial',
    source: `netstat -ib interface counters, ${WHOLE_MAC}. Wi-Fi is en0, checked with networksetup.`,
    component: name === 'Wi-Fi' ? 'wifi' : 'network-road',
  };
}

export function programRow(event: ProgramEvent): WireRow | null {
  const build = (from: string, to: string, protocol: string, length: string, info: string, status: Status, source: string, component: string): WireRow => ({
    at: event.at,
    group: 'build',
    from,
    to,
    protocol,
    length,
    info,
    status,
    source: `${source} ${LIVE_NOTE}`,
    component,
  });

  switch (event.type) {
    case 'fetch':
      return build('Network', 'Renderer', 'FETCH', formatBytes(event.bytes), `${event.file}, ${event.ms.toFixed(2)} ms`, 'measured', 'PerformanceResourceTiming over loopback.', 'stop-1');
    case 'compile':
      return build('Renderer', 'ANGLE', 'GLSL', '', `Compile vertex + fragment, ${event.compileMs.toFixed(2)} ms (calls ${event.callsMs.toFixed(2)} ms)`, 'partial', 'compileShader plus blocking COMPILE_STATUS.', 'stop-4');
    case 'link':
      return build('ANGLE', 'Metal compiler', 'GLSL', '', `Link program, ${event.linkMs.toFixed(2)} ms`, 'partial', 'linkProgram plus blocking LINK_STATUS.', 'stop-5');
    case 'round-trip':
      return build('Renderer', 'GPU process', 'IPC', '', `Round trip ${event.ms.toFixed(3)} ms`, 'partial', 'Median of 7 gl.getError() calls, a proxy.', 'stop-2+3');
    case 'first-draw':
      return build('Metal compiler', 'GPU', 'DRAW', '', `First draw ${event.ms.toFixed(2)} ms`, 'partial', 'First draw plus getError.', 'stop-5');
    case 'frame': {
      const pace = event.deltaMs === null ? '' : `, ${event.deltaMs.toFixed(1)} ms since last frame`;
      return {
        at: event.at,
        group: 'frame',
        from: 'Renderer',
        to: 'GPU cores',
        protocol: 'FRAME',
        length: `${LIVE_PROGRAM.width}x${LIVE_PROGRAM.height}`,
        info: `#${event.frame}: GPU ${event.gpuMs.toFixed(1)} ms, 1 draw call${pace}`,
        status: 'partial',
        source: `TIME_ELAPSED_EXT around the frame's one draw, a time range rather than busy time. ${LIVE_NOTE}`,
        component: 'stop-6',
      };
    }
    default:
      return null;
  }
}
