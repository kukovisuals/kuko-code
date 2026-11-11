// Pure: for each hardware block, how busy it is and whether a WebGL fragment shader can use it, plus which
// part is the bottleneck. No Three.js, so it runs in tests. Loads are partial and whole Mac; the verdict is modeled.
import type { HardwareEvent } from '../../shared/liveEvents';
import type { GpuFill } from '../gpuFill';

// Our thresholds, not from any source. The page says so.
export const IDLE_PERCENT = 10;
export const IDLE_KB_PER_SEC = 1;
export const FULL_PERCENT = 90;
export const THRESHOLD_SOURCE = `Our own thresholds: idle is under ${IDLE_PERCENT}% (under ${IDLE_KB_PER_SEC} KB/s for Wi-Fi), full is ${FULL_PERCENT}% or more. Not from any source.`;

export type Reach = 'yes' | 'indirectly' | 'no';

export interface Load {
  value: number;
  unit: '%' | 'KB/s';
  source: string;
}

export interface BlockRoom {
  blockId: string;
  name: string;
  // Null means no reading. A block with no reading is never called idle.
  load: Load | null;
  noReading: string | null;
  idle: boolean;
  reach: Reach;
  reason: string;
  reasonTag: string;
  reasonSource: string;
}

export interface Verdict {
  part: 'gpu' | 'cpu' | 'none' | 'unknown';
  text: string;
  source: string;
}

const GPU_SOURCE = 'ioreg IOAccelerator PerformanceStatistics, Device Utilization %. Whole GPU, every app, the city tab included.';
const CPU_SOURCE = 'Node os.cpus(), busy ticks since the last sample, averaged over the cluster\'s 4 cores. Whole Mac, every app.';
const NET_SOURCE = 'netstat -ib Wi-Fi interface counters, in plus out. Whole Mac.';
const NO_ROOT = 'No reading without root. T31 would add power readings.';

const CHROMIUM_SOURCE = "Chromium GPU architecture docs and ANGLE's Metal back end: WebGL draws become Metal work run on the GPU";

interface Fixed {
  blockId: string;
  name: string;
  reach: Reach;
  reason: string;
  reasonTag: string;
  reasonSource: string;
}

const CLUSTER_REACH: Omit<Fixed, 'blockId' | 'name'> = {
  reach: 'indirectly',
  reason:
    "A fragment shader can't run on the CPU. JS can only take work that is the same for every pixel and pass it in as a uniform. T29 tried that on Day 442, not Day 564, and saw no clear saving.",
  reasonTag: 'partial',
  reasonSource: `${CHROMIUM_SOURCE}. T29 result for Day 442 in data/experiments/day442.json: fold matrix from JS saved 2.0 and 2.2 ms, inside the noise. Not tried on Day 564`,
};

// Reach doesn't change while the page runs, so it is fixed here with its reason.
const BLOCKS: Fixed[] = [
  {
    blockId: 'gpu-core',
    name: 'GPU cores',
    reach: 'yes',
    reason: 'The fragment shader runs here, on all 10 cores. Metal picks the cores, not the page.',
    reasonTag: 'published',
    reasonSource: CHROMIUM_SOURCE,
  },
  { blockId: 'p-cluster', name: 'P cluster', ...CLUSTER_REACH },
  { blockId: 'e-cluster', name: 'E cluster', ...CLUSTER_REACH },
  {
    blockId: 'slc',
    name: 'System-level cache',
    reach: 'indirectly',
    reason: "The GPU's memory reads pass through it on their own. A shader can't choose what stays in it.",
    reasonTag: 'community',
    reasonSource: 'metal-benchmarks: the SLC is shared by the CPU and GPU. WebGL2 has no call that controls a cache',
  },
  {
    blockId: 'memory-ring',
    name: 'Unified memory',
    reach: 'indirectly',
    reason: 'A shader reaches memory only by reading textures and buffers. Day 564 reads none: it is pure math.',
    reasonTag: 'measured',
    reasonSource: 'shaders/day564-image.glsl contains no texture, iChannel or sampler',
  },
  {
    blockId: 'neural-engine',
    name: 'Neural Engine',
    reach: 'no',
    reason: 'WebGL has no path to it. Apps reach it through Core ML, not through a shader.',
    reasonTag: 'published',
    reasonSource: 'Apple Core ML docs: models run on the CPU, GPU or Neural Engine. The WebGL2 spec has no such path',
  },
  {
    blockId: 'media-engine',
    name: 'Media engine',
    reach: 'no',
    reason: 'It decodes and encodes video. A page reaches it through a video element or WebCodecs, never from a shader.',
    reasonTag: 'published',
    reasonSource: 'Apple M2 press release: media engine for video decode and encode. WebCodecs spec',
  },
  {
    blockId: 'display-engines',
    name: 'Display engines',
    reach: 'no',
    reason: 'It works on finished frames, after the shader has run. More room here makes no pixel cheaper.',
    reasonTag: 'community',
    reasonSource: 'Asahi Linux docs: display controllers scan out finished frames',
  },
  {
    blockId: 'wifi',
    name: 'Wi-Fi',
    reach: 'no',
    reason: 'The shader files come over loopback, and the shader reads nothing from the network while it runs.',
    reasonTag: 'measured',
    reasonSource: 'The live feed: shader requests are served by the dev server on this Mac',
  },
  {
    blockId: 'ssd',
    name: 'SSD',
    reach: 'no',
    reason: 'The .glsl files are read once at load. Nothing is read from it during a frame.',
    reasonTag: 'measured',
    reasonSource: 'The live feed: one file read per shader file, at load',
  },
];

export const SPARE_BLOCK_IDS = BLOCKS.map((block) => block.blockId);

const average = (values: number[]) => (values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length);

function loadFor(blockId: string, event: HardwareEvent): Load | null {
  if (blockId === 'gpu-core') {
    return event.gpu ? { value: event.gpu.devicePercent, unit: '%', source: GPU_SOURCE } : null;
  }
  if (blockId === 'p-cluster' || blockId === 'e-cluster') {
    const value = average(blockId === 'p-cluster' ? event.pCorePercents : event.eCorePercents);
    return value === null ? null : { value: Math.round(value), unit: '%', source: CPU_SOURCE };
  }
  if (blockId === 'wifi' && event.wifi) {
    return { value: Math.round((event.wifi.inBytesPerSec + event.wifi.outBytesPerSec) / 1024), unit: 'KB/s', source: NET_SOURCE };
  }
  return null;
}

function noReadingText(blockId: string, event: HardwareEvent): string {
  if (blockId === 'memory-ring') {
    const mb = event.gpu ? `. GPU memory in use is ${Math.round(event.gpu.inUseMemoryBytes / (1024 * 1024))} MB, but that is size, not load` : '';
    return `Bandwidth use isn't readable without root${mb}.`;
  }
  if (blockId === 'ssd') {
    return 'No load reading. The read time per file is in the live readings.';
  }
  if (blockId === 'gpu-core' || blockId === 'wifi') {
    return 'The dev server sent no reading this sample.';
  }
  return NO_ROOT;
}

function isIdle(load: Load | null): boolean {
  if (!load) {
    return false;
  }
  return load.unit === '%' ? load.value < IDLE_PERCENT : load.value < IDLE_KB_PER_SEC;
}

export function spareRoom(event: HardwareEvent): BlockRoom[] {
  return BLOCKS.map((block) => {
    const load = loadFor(block.blockId, event);
    return { ...block, load, noReading: load ? null : noReadingText(block.blockId, event), idle: isIdle(load) };
  });
}

const CITY_CAVEAT = 'The GPU reading covers the whole Mac, and the city tab draws on the GPU too.';

// A rule applied to partial readings, so the result is modeled. It prints the readings it used.
export function bottleneck(event: HardwareEvent, fill: GpuFill | null, programRunning: boolean): Verdict {
  const source = `${THRESHOLD_SOURCE} Uses the GPU device %, every core's %, and stop 6's median gpuMs against the frame budget.`;
  const gpu = event.gpu?.devicePercent ?? null;
  const cores = [...event.pCorePercents, ...event.eCorePercents];
  const busiest = cores.length === 0 ? null : Math.round(Math.max(...cores));
  const frame = fill ? ` Each frame's draw takes ${fill.gpuMs.toFixed(2)} ms of GPU time against a ${fill.budgetMs.toFixed(2)} ms budget.` : ' No GPU frame time yet.';

  if (gpu === null) {
    return { part: 'unknown', text: 'No GPU reading this sample, so the page cannot name the bottleneck.', source };
  }
  // With the program stopped, whatever the GPU is doing isn't the shader's, so no verdict is given for it.
  if (!programRunning) {
    return {
      part: 'unknown',
      text: `The program is stopped, so there is no shader to judge. The GPU still reads ${gpu}% and the busiest CPU core ${busiest ?? 'no reading'}%: that is the city and other apps, and it shows how much of the running reading isn't the shader.`,
      source,
    };
  }
  if (gpu >= FULL_PERCENT) {
    const late = fill !== null && fill.gpuMs > fill.budgetMs;
    const outcome = late
      ? ' It misses the budget. The shader can only run here, so the fix is less work per pixel.'
      : fill
        ? ' It still meets the budget, so frames are on time, but there is no room here to add work.'
        : '';
    return {
      part: 'gpu',
      text: `The GPU is the bottleneck: busy ${gpu}%, while the busiest CPU core is at ${busiest ?? 'no reading'}%.${frame}${outcome} ${CITY_CAVEAT}`,
      source,
    };
  }
  if (busiest !== null && busiest >= FULL_PERCENT) {
    return {
      part: 'cpu',
      text: `A CPU core is full (${busiest}%) while the GPU is at ${gpu}%.${frame} One thread may be holding frames back. Which process it is isn't known from this reading.`,
      source,
    };
  }
  return {
    part: 'none',
    text: `Nothing is full: GPU ${gpu}%, busiest CPU core ${busiest ?? 'no reading'}%.${frame} ${CITY_CAVEAT}`,
    source,
  };
}
