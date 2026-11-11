// Builds the "measured live" and "what each pass asks" rows from current data.
import { BUFFER, VOLUME_SIZE } from './dayRenderer';
import { totalMs, type LiveHistory } from './liveHistory';
import { median, percentile } from './numbers';
import { formatCount, formatMs, type PanelRow } from './panelRows';
import { stepsPerCell, volumeWorkload, type Mouse } from './workload';

const TIMER_SOURCE = 'TIME_ELAPSED_EXT around this pass, last 300 frames. A time range across Metal command buffers, so it can include waits.';

function stats(summary: { median: number; p95: number }): string {
  return `${formatMs(summary.median)} · p95 ${formatMs(summary.p95)}`;
}

export function liveRows(history: LiveHistory, frameDeltas: readonly number[]): PanelRow[] {
  return [
    { label: 'Volume A', value: stats(history.summary((sample) => sample.volume)), status: 'partial', source: TIMER_SOURCE },
    { label: 'Image', value: stats(history.summary((sample) => sample.image)), status: 'partial', source: TIMER_SOURCE },
    {
      label: 'Both passes',
      value: stats(history.summary(totalMs)),
      status: 'partial',
      source: 'The two timer readings added up frame by frame. Covers GPU work only, not the compositor.',
    },
    {
      label: 'Time between frames',
      value: stats({ median: median(frameDeltas), p95: percentile(frameDeltas, 0.95) }),
      status: 'measured',
      source: 'requestAnimationFrame deltas. When the GPU can\'t keep up, this rises past the display\'s budget.',
    },
  ];
}

export function workRows(mouse: Mouse): PanelRow[] {
  const volume = volumeWorkload(VOLUME_SIZE);
  const cells = stepsPerCell(BUFFER.width, BUFFER.height, { columns: 16, rows: 10 }, mouse);
  const meanSteps = cells.reduce((sum, value) => sum + value, 0) / cells.length;
  const pixels = BUFFER.width * BUFFER.height;
  return [
    {
      label: 'Volume A: fragments',
      value: formatCount(volume.voxels),
      status: 'modeled',
      source: `One per voxel, ${VOLUME_SIZE}³. The size comes from the shader's code, because the export doesn't state it.`,
    },
    {
      label: 'Volume A: texture reads',
      value: formatCount(volume.texelFetches),
      status: 'modeled',
      source: `7 reads for each of ${formatCount(volume.activeVoxels)} voxels past the early return.`,
    },
    {
      label: 'Volume A: render targets',
      value: `${volume.renderTargets} per frame`,
      status: 'modeled',
      source: 'One layer per draw. That each switch costs a separate Metal render pass is inferred, not observed.',
    },
    {
      label: 'Image: fragments',
      value: formatCount(pixels),
      status: 'modeled',
      source: `${BUFFER.width} x ${BUFFER.height}, a fixed buffer so results stay comparable across displays.`,
    },
    {
      label: 'Image: march steps',
      value: formatCount(pixels * meanSteps),
      status: 'modeled',
      source: `About ${Math.round(meanSteps)} steps per pixel for this view, each with one volume read. Worked out from the ray and cube math.`,
    },
  ];
}
