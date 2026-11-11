// Pure plan of what to draw for each stop. buildStops.ts turns this plan into Three.js objects.
import type { Metric, Recording, Stop } from '../shared/types';
import { splitFloors } from './heightScale';
import { siteForStop, type Rect } from './layoutMap';

export type Trip = 'build' | 'frame';

export interface PlannedFloor {
  metric: Metric;
  height: number;
}

export interface PlannedLane {
  trip: Trip;
  rect: Rect;
  floors: PlannedFloor[];
  // Floors with a null value. They render as a labeled placeholder, never as zero height.
  missing: Metric[];
  totalMs: number;
  totalHeight: number;
}

export interface PlannedBuilding {
  title: string;
  stops: Stop[];
  site: Rect;
  lanes: PlannedLane[];
  // Why this stop has no time-based height. Set for stops 7 and 8.
  noHeightReason?: string;
}

const NO_HEIGHT_REASONS: Record<number, string> = {
  7: 'No time of its own: stops 6 and 7 share one GPU number',
  8: 'No time-based height: compositor time is unknown',
};

function floorMetrics(stop: Stop): Metric[] {
  return stop.floors.flatMap((id) => stop.metrics.filter((metric) => metric.id === id));
}

function planLane(trip: Trip, rect: Rect, metrics: Metric[]): PlannedLane {
  const present = metrics.filter((metric) => metric.value !== null);
  const split = splitFloors(present.map((metric) => metric.value as number));
  return {
    trip,
    rect,
    floors: present.map((metric, index) => ({ metric, height: split.floorHeights[index] })),
    missing: metrics.filter((metric) => metric.value === null),
    totalMs: split.totalMs,
    totalHeight: split.totalHeight,
  };
}

// roundTripMs is one proxy measurement that both trips cross, so it sits on both lanes.
export function floorBelongsToTrip(metricId: string, trip: Trip): boolean {
  if (metricId === 'roundTripMs') {
    return true;
  }
  return metricId.startsWith('frame') ? trip === 'frame' : trip === 'build';
}

function planSharedBuilding(renderer: Stop, gpuProcess: Stop): PlannedBuilding {
  const site = siteForStop(renderer.stop);
  const laneWidth = (site.w - 0.2) / 2;
  const metrics = [...floorMetrics(renderer), ...floorMetrics(gpuProcess)];
  const lane = (trip: Trip, x: number) =>
    planLane(
      trip,
      { x, z: site.z, w: laneWidth, d: site.d },
      metrics.filter((metric) => floorBelongsToTrip(metric.id, trip)),
    );
  return {
    title: `${renderer.stop} ${renderer.name} + ${gpuProcess.stop} ${gpuProcess.name}`,
    stops: [renderer, gpuProcess],
    site,
    lanes: [lane('build', site.x), lane('frame', site.x + laneWidth + 0.2)],
  };
}

function planSingleBuilding(stop: Stop, trip: Trip): PlannedBuilding {
  const site = siteForStop(stop.stop);
  const metrics = floorMetrics(stop);
  return {
    title: `${stop.stop} ${stop.name}`,
    stops: [stop],
    site,
    lanes: metrics.length > 0 ? [planLane(trip, site, metrics)] : [],
    noHeightReason: NO_HEIGHT_REASONS[stop.stop],
  };
}

export function planBuildings(recording: Recording): PlannedBuilding[] {
  const byNumber = (stop: number) => recording.stops.find((entry) => entry.stop === stop) as Stop;
  return [
    planSingleBuilding(byNumber(1), 'build'),
    planSharedBuilding(byNumber(2), byNumber(3)),
    planSingleBuilding(byNumber(4), 'build'),
    planSingleBuilding(byNumber(5), 'build'),
    planSingleBuilding(byNumber(6), 'frame'),
    planSingleBuilding({ ...byNumber(7), floors: [] }, 'frame'),
    planSingleBuilding({ ...byNumber(8), floors: [] }, 'frame'),
  ];
}
