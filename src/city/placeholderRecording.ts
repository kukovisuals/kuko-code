// Invented numbers for previewing the city before the recorder exists (T09 to T16).
// Each status is the one backlog R4 plans for that stop, so the preview shows the final drawing style.
// Every source says "INVENTED", and the page shows a fixed banner whenever this data is on screen.
import hardwareMap from '../../data/hardware-map.m2.json';
import type { DisplayLabel, Metric, MetricUnit, Recording, Status, Stop } from '../shared/types';

const PLACEHOLDER_SHA256 = '0'.repeat(64);

function invented(id: string, value: number, unit: MetricUnit, status: Status, willComeFrom: string): Metric {
  return { id, value, unit, status, source: `INVENTED for layout preview, not measured. Will come from: ${willComeFrom}` };
}

function stop(number: number, name: string, blockId: string, status: Status, metrics: Metric[], floors: string[]): Stop {
  return { stop: number, name, blockId, status, metrics, floors };
}

export function isPlaceholderRecording(recording: Recording): boolean {
  return recording.shader.sha256 === PLACEHOLDER_SHA256;
}

export function buildPlaceholderRecording(display: Extract<DisplayLabel, 'built-in' | 'lg'>): Recording {
  const frameDeltaMs = display === 'built-in' ? 16.67 : 20;
  const refreshHz = display === 'built-in' ? 60 : 50;
  return {
    schemaVersion: 1,
    recordedAt: '2026-11-05T00:00:00.000Z',
    environment: {
      browserMajor: 156,
      glRenderer: 'INVENTED preview, no renderer was read',
      timerQueryExposed: false,
      parallelCompileExposed: false,
      timeElapsedBits: 0,
      timestampBits: 0,
    },
    capture: {
      cacheState: 'unknown',
      drawingBuffer: { width: 1280, height: 800 },
      devicePixelRatio: 2,
      display,
      warmupFrames: 0,
      sampledFrames: 1,
      crossOriginIsolated: true,
    },
    shader: { file: 'shaders/INVENTED-preview.glsl', bytes: 0, sha256: PLACEHOLDER_SHA256 },
    hardwareMap: hardwareMap as Recording['hardwareMap'],
    stops: [
      stop(1, 'Network', 'network-road', 'measured', [
        invented('fetchMs', 2, 'ms', 'measured', 'PerformanceResourceTiming over loopback'),
      ], ['fetchMs']),
      stop(2, 'Renderer', 'cpu', 'measured', [
        invented('buildCallsMs', 0.5, 'ms', 'measured', 'performance.now() around build calls'),
        invented('frameCallsMs', 0.1, 'ms', 'measured', 'performance.now() around draw calls'),
      ], ['buildCallsMs', 'frameCallsMs']),
      stop(3, 'GPU process', 'cpu', 'partial', [
        invented('roundTripMs', 0.2, 'ms', 'partial', 'gl.getError() flush and round trip, a proxy'),
      ], ['roundTripMs']),
      stop(4, 'ANGLE', 'cpu', 'partial', [
        invented('compileMs', 5, 'ms', 'partial', 'compileShader plus blocking COMPILE_STATUS'),
      ], ['compileMs']),
      stop(5, 'Metal compiler', 'cpu', 'partial', [
        invented('linkMs', 20, 'ms', 'partial', 'linkProgram plus blocking LINK_STATUS'),
        invented('firstDrawMs', 40, 'ms', 'partial', 'First drawArrays plus getError'),
        invented('steadyDrawMs', 0.5, 'ms', 'partial', 'Later drawArrays plus getError, a baseline'),
      ], ['linkMs', 'firstDrawMs']),
      stop(6, 'GPU tiles', 'gpu', 'partial', [
        invented('gpuMs', 4, 'ms', 'partial', 'TIME_ELAPSED_EXT over sampled frames'),
        invented('gpuMsWarmup', 5, 'ms', 'partial', 'TIME_ELAPSED_EXT over warmup frames'),
      ], ['gpuMs']),
      stop(7, 'SIMD groups', 'gpu-core', 'modeled', [
        invented('tileCount', 1000, 'count', 'modeled', 'Buffer size at 32 x 32 tiles'),
        invented('simdGroups', 32000, 'count', 'modeled', 'Pixels / 32, a lower bound'),
      ], []),
      stop(8, 'Compositor + display', 'display-engines', 'partial', [
        invented('frameDeltaMs', frameDeltaMs, 'ms', 'partial', 'Median requestAnimationFrame delta'),
        invented('refreshHz', refreshHz, 'Hz', 'partial', 'Derived from the median rAF delta'),
      ], []),
    ],
    imports: [],
  };
}
