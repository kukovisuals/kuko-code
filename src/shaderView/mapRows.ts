// The words and rows that report the cost map's own checks. The verdict comes from this run's numbers,
// so a failed check always says so on the page. The cutoffs are judgement calls, and the page says that.
import type { CostMapResult } from './costMap';
import type { MapView } from './costOverlay';
import { formatMs, type PanelRow } from './panelRows';

export function mapRows(result: CostMapResult): PanelRow[] {
  const ratio = result.sumOfCellsMs / result.fullFrameMs;
  return [
    {
      label: 'Whole Image pass, drawn alone',
      value: formatMs(result.fullFrameMs),
      status: 'partial',
      source: `Median of ${result.rounds} draws of the frozen picture, each followed by readPixels, from the GPU timer. This can differ from the live reading.`,
    },
    {
      label: '1-pixel draw',
      value: formatMs(result.floorMs),
      status: 'partial',
      source: 'The same timer around a nearly empty draw. Every region reading includes a cost of about this size.',
    },
    {
      label: 'All 160 regions ÷ whole pass',
      value: `${ratio.toFixed(2)}x`,
      status: 'partial',
      source: `${formatMs(result.sumOfCellsMs)} summed, calculated from the timer readings. 1x would mean the regions account for the pass exactly.`,
    },
    {
      label: 'Day 560 pattern vs control pattern',
      value: `r = ${result.stripeCorrelation.toFixed(2)}`,
      status: 'partial',
      source: 'Correlation of the two grids\' left-right patterns, using each column\'s median. Near 1 means they share a pattern that neither shader asks for.',
    },
    {
      label: 'Columns vs march steps: Day 560',
      value: `r = ${result.columnStepsCorrelation.toFixed(2)}`,
      status: 'partial',
      source: 'Rank correlation of measured column time with modeled steps, so a single spike can\'t dominate. Near 1 means columns with more steps took longer.',
    },
    {
      label: 'Columns vs march steps: control',
      value: `r = ${result.controlColumnStepsCorrelation.toFixed(2)}`,
      status: 'partial',
      source: 'The same check on a shader with no march steps. It shows what no real link looks like.',
    },
  ];
}

export function mapVerdict(result: CostMapResult): string {
  const ratio = result.sumOfCellsMs / result.fullFrameMs;
  const stepsLink = result.columnStepsCorrelation;
  const sentences = [
    ratio > 0.75 && ratio < 1.5
      ? 'The regions add up to about the whole pass.'
      : 'The regions don\'t add up to the whole pass, so don\'t read them as exact per-region time.',
    result.stripeCorrelation > 0.7
      ? 'The grid shares its left-right pattern with the control, so that pattern comes from the GPU or driver, not from your shader.'
      : 'The grid doesn\'t clearly share the control\'s pattern in this run.',
    stepsLink > 0.7
      ? 'Column times rise with march steps in this run. That supports the march steps map from left to right, but nothing measured checks it from top to bottom.'
      : stepsLink > result.controlColumnStepsCorrelation + 0.3
        ? 'Column times loosely rise with march steps, more than the control does. That is some support for the march steps map, not proof.'
        : 'Column times don\'t rise with march steps more than the control does in this run, so nothing measured supports that map.',
  ];
  return `${sentences.join(' ')} The cutoffs behind this text (0.7, 0.3, and 0.75x to 1.5x) are judgement calls.`;
}

export function legendNote(view: Exclude<MapView, 'picture'>, rounds: number): string {
  if (view === 'gpu') return `Median of ${rounds} rounds, from the GPU timer around one scissored region. Compare it with the control before reading this as your shader's cost.`;
  if (view === 'control') return `The same timing with cost-mid, a shader with the same cost at every pixel. Median of ${rounds} rounds. A pattern here comes from the GPU or driver, not from a shader.`;
  return 'Average steps per pixel, worked out from the shader\'s ray and cube math. Not a measurement.';
}
