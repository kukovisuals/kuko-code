// Reads this Mac's counters with tools that need no root, and turns running totals into rates.
import { execFile } from 'node:child_process';
import os from 'node:os';
import type { FlowDelta, HardwareEvent, InterfaceRate } from '../src/shared/liveEvents';
import { parseGpuStats, parseInterfaceCounters, parseLoopbackFlows, type InterfaceCounters } from './parseNative';

// Checked on this M2 on 2026-11-06: background-QoS work, which macOS keeps on E cores, ran cpu0 to cpu3
// at 99% and left cpu4 to cpu7 near idle.
const E_CORE_COUNT = 4;
const WIFI_INTERFACE = 'en0';
const LOOPBACK_INTERFACE = 'lo0';

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 1500, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => resolve(error ? '' : stdout));
  });
}

interface CoreTicks {
  busy: number;
  total: number;
}

function readCoreTicks(): CoreTicks[] {
  return os.cpus().map(({ times }) => {
    const busy = times.user + times.nice + times.sys + times.irq;
    return { busy, total: busy + times.idle };
  });
}

function rate(now: InterfaceCounters | null, before: InterfaceCounters | undefined, seconds: number): InterfaceRate | null {
  if (!now || !before) {
    return null;
  }
  return {
    inBytesPerSec: (now.inBytes - before.inBytes) / seconds,
    outBytesPerSec: (now.outBytes - before.outBytes) / seconds,
    inPacketsPerSec: (now.inPackets - before.inPackets) / seconds,
    outPacketsPerSec: (now.outPackets - before.outPackets) / seconds,
  };
}

export function createHardwareSampler(serverPort: number, feedClientPorts: () => Set<number>) {
  let lastAt = Date.now();
  let lastTicks = readCoreTicks();
  const lastCounters = new Map<string, InterfaceCounters>();
  // Null until the first sample, whose totals only set the baseline: they cover each connection's whole life.
  let lastFlows: Map<number, { inBytes: number; outBytes: number }> | null = null;

  return async function sample(): Promise<HardwareEvent> {
    const [gpuText, netText, flowText] = await Promise.all([
      run('ioreg', ['-r', '-d', '1', '-w', '0', '-c', 'IOAccelerator']),
      run('netstat', ['-ibn']),
      run('nettop', ['-L', '1', '-m', 'tcp', '-n', '-x', '-J', 'bytes_in,bytes_out,state']),
    ]);
    const at = Date.now();
    const seconds = Math.max((at - lastAt) / 1000, 0.001);

    const ticks = readCoreTicks();
    const percents = ticks.map((now, index) => {
      const before = lastTicks[index] as CoreTicks;
      const total = now.total - before.total;
      return total > 0 ? ((now.busy - before.busy) / total) * 100 : 0;
    });

    const interfaceRate = (name: string): InterfaceRate | null => {
      const now = parseInterfaceCounters(netText, name);
      const result = rate(now, lastCounters.get(name), seconds);
      if (now) {
        lastCounters.set(name, now);
      }
      return result;
    };
    const wifi = interfaceRate(WIFI_INTERFACE);
    const loopback = interfaceRate(LOOPBACK_INTERFACE);

    const totals = parseLoopbackFlows(flowText, serverPort);
    const feedPorts = feedClientPorts();
    const previousFlows = lastFlows;
    const flows: FlowDelta[] = totals.flatMap((flow) => {
      if (!previousFlows) {
        return [];
      }
      const before = previousFlows.get(flow.clientPort) ?? { inBytes: 0, outBytes: 0 };
      const inBytes = Math.max(flow.inBytes - before.inBytes, 0);
      const outBytes = Math.max(flow.outBytes - before.outBytes, 0);
      return inBytes + outBytes > 0
        ? [{ serverPort, clientPort: flow.clientPort, inBytes, outBytes, isThisFeed: feedPorts.has(flow.clientPort) }]
        : [];
    });
    lastFlows = new Map(totals.map((flow) => [flow.clientPort, { inBytes: flow.inBytes, outBytes: flow.outBytes }]));

    lastAt = at;
    lastTicks = ticks;
    return {
      type: 'hardware',
      at,
      eCorePercents: percents.slice(0, E_CORE_COUNT),
      pCorePercents: percents.slice(E_CORE_COUNT),
      gpu: parseGpuStats(gpuText),
      loopback,
      wifi,
      flows,
    };
  };
}
