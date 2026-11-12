// Stop 3: what one crossing into the GPU process costs. gl.getError() can't answer from the page,
// so Chrome flushes the command buffer, asks the GPU process over IPC, and waits for the reply.
import type { Metric } from '../shared/types';
import { summarize } from './summarize';

export type Trip = 'build' | 'frame';

// Untimed getError: makes the GPU process catch up, so the next timed call finds an empty queue.
// It also checks that nothing before it failed, because a failed call would make the run wrong.
export function drainQueue(gl: WebGL2RenderingContext): void {
  const error = gl.getError();
  if (error !== gl.NO_ERROR) {
    throw new Error(`WebGL reported error 0x${error.toString(16)} before a round trip`);
  }
}

// Call only right after drainQueue or another blocking call, so the reading is the bare crossing
// and not the GPU process finishing earlier commands.
export function timeRoundTrip(gl: WebGL2RenderingContext): number {
  const start = performance.now();
  gl.getError();
  return performance.now() - start;
}

const MOMENT: Record<Trip, string> = {
  build: 'after each build repeat, once a blocking LINK_STATUS read had emptied the queue',
  frame: 'after each sampled frame, once an untimed getError() had emptied the queue',
};

export function roundTripMetric(trip: Trip, readings: number[]): Metric {
  const stats = summarize(readings);
  return {
    id: `${trip}RoundTripMs`,
    value: stats?.median ?? null,
    unit: 'ms',
    status: 'partial',
    source: `performance.now() around one gl.getError(), ${MOMENT[trip]}. ${readings.length} readings.`,
    note:
      'A proxy: it times the flush and the IPC reply, plus anything the GPU process was still doing. ' +
      'It does not time the command buffer being executed, or any GPU work.',
    ...(stats ? { stats } : {}),
  };
}
