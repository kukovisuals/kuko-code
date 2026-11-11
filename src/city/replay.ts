// Pure replay timeline, built only from recorded values. Nothing here measures anything.
import type { Metric, Recording } from '../shared/types';
import { floorBelongsToTrip, type Trip } from './planBuildings';
import { BUILD_LEGS, FRAME_LEGS, PIPELINE_TO_FRAME_LEG, pointAlong, type Leg, type Point } from './routePlan';

const BUILD_DWELL_TARGET_SEC = 6;
const FRAME_DWELL_TARGET_SEC = 2;
const FRAME_LAPS = 2;
// Roads have no measured time, so every road takes the same arbitrary time.
const ROAD_SEC = 0.45;

export interface TimelineStep {
  kind: 'road' | 'dwell';
  trip: Trip;
  durationSec: number;
  points: Point[];
  stop?: number;
  metric?: Metric;
  note?: string;
}

export interface Timeline {
  steps: TimelineStep[];
  totalSec: number;
  buildSlowdown: number;
  frameSlowdown: number;
}

function floorMetricsFor(recording: Recording, stop: number, trip: Trip): Metric[] {
  const entry = recording.stops.find((candidate) => candidate.stop === stop);
  if (!entry) {
    return [];
  }
  // Only stops 2 and 3 are on both trips, so only their floors need sorting by trip.
  const isShared = stop === 2 || stop === 3;
  return entry.floors
    .filter((id) => !isShared || floorBelongsToTrip(id, trip))
    .flatMap((id) => entry.metrics.filter((metric) => metric.id === id && metric.value !== null));
}

function dwellTotalMs(recording: Recording, stops: number[], trip: Trip): number {
  return stops
    .flatMap((stop) => floorMetricsFor(recording, stop, trip))
    .reduce((sum, metric) => sum + (metric.value as number), 0);
}

function slowdownFor(totalMs: number, targetSec: number): number {
  return totalMs > 0 ? (targetSec * 1000) / totalMs : 1;
}

function dwellNote(stop: number): string | undefined {
  if (stop === 7) {
    return 'Stop 7: no time of its own, included in stop 6';
  }
  return stop === 8 ? 'Stop 8: compositor time unknown, no dwell' : undefined;
}

export function buildTimeline(recording: Recording): Timeline {
  const buildSlowdown = slowdownFor(dwellTotalMs(recording, [1, 2, 3, 4, 5], 'build'), BUILD_DWELL_TARGET_SEC);
  const frameSlowdown = slowdownFor(dwellTotalMs(recording, [2, 3, 6], 'frame'), FRAME_DWELL_TARGET_SEC);
  const steps: TimelineStep[] = [];

  const dwellAt = (stop: number, at: Point, trip: Trip) => {
    const slowdown = trip === 'build' ? buildSlowdown : frameSlowdown;
    for (const metric of floorMetricsFor(recording, stop, trip)) {
      const durationSec = ((metric.value as number) * slowdown) / 1000;
      steps.push({ kind: 'dwell', trip, durationSec, points: [at], stop, metric });
    }
    const note = dwellNote(stop);
    if (note) {
      steps.push({ kind: 'dwell', trip, durationSec: 0.6, points: [at], stop, note });
    }
  };

  const drive = (leg: Leg, trip: Trip) => {
    steps.push({ kind: 'road', trip, durationSec: ROAD_SEC, points: leg.points });
    if (typeof leg.to === 'number') {
      dwellAt(leg.to, leg.points[leg.points.length - 1], trip);
    }
  };

  dwellAt(1, BUILD_LEGS[0].points[0], 'build');
  BUILD_LEGS.forEach((leg) => drive(leg, 'build'));
  drive(PIPELINE_TO_FRAME_LEG, 'frame');
  for (let lap = 0; lap < FRAME_LAPS; lap += 1) {
    FRAME_LEGS.forEach((leg) => drive(leg, 'frame'));
  }

  const totalSec = steps.reduce((sum, step) => sum + step.durationSec, 0);
  return { steps, totalSec, buildSlowdown, frameSlowdown };
}

export interface TimelineSample {
  step: TimelineStep;
  position: Point;
}

export function sampleTimeline(timeline: Timeline, timeSec: number): TimelineSample | null {
  let remaining = timeSec;
  for (const step of timeline.steps) {
    if (remaining < step.durationSec) {
      const progress = step.durationSec > 0 ? remaining / step.durationSec : 1;
      return { step, position: pointAlong(step.points, progress) };
    }
    remaining -= step.durationSec;
  }
  return null;
}
