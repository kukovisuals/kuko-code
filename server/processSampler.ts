// Turns each process's running CPU-time total into a share of one core for the last sample.
import type { ProcessLoads } from '../src/shared/liveEvents';
import { parseProcessTimes, type ProcessTime } from './parseNative';

// Pure. A process that wasn't in the earlier sample has no "before", so it counts as 0 this time.
export function processLoads(before: ProcessTime[], now: ProcessTime[], seconds: number, nodePercent: number): ProcessLoads {
  const earlier = new Map(before.map((entry) => [entry.pid, entry.cpuSeconds]));
  const percent = (entry: ProcessTime) => {
    const start = earlier.get(entry.pid);
    return start === undefined ? 0 : (Math.max(entry.cpuSeconds - start, 0) / seconds) * 100;
  };
  const renderers = now.filter((entry) => entry.kind === 'chrome-renderer').map(percent);
  const gpu = now.filter((entry) => entry.kind === 'chrome-gpu').map(percent);
  return {
    nodePercent,
    gpuProcessPercent: gpu.length > 0 ? Math.max(...gpu) : null,
    rendererCount: renderers.length,
    renderersPercent: renderers.reduce((total, value) => total + value, 0),
    busiestRendererPercent: Math.max(0, ...renderers),
  };
}

export function createProcessSampler() {
  let last: ProcessTime[] | null = null;
  // Node reports this dev server's own CPU time directly, so ps isn't needed for it.
  let lastNode = process.cpuUsage();

  return function sample(psText: string, seconds: number): ProcessLoads | null {
    const node = process.cpuUsage(lastNode);
    lastNode = process.cpuUsage();
    const nodePercent = ((node.user + node.system) / 1e6 / seconds) * 100;
    const now = parseProcessTimes(psText);
    const before = last;
    last = psText ? now : null;
    return before && psText ? processLoads(before, now, seconds, nodePercent) : null;
  };
}
