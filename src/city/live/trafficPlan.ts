// Pure: where a real event's dot travels and how long it stops. Road speed is arbitrary, because no
// road has a measured time. A stop's wait is that event's own measured ms, slowed by a printed factor.
import {
  BUILD_LEGS,
  EXIT_BUILT_IN_ROAD,
  EXIT_LG_ROAD,
  FRAME_LEGS,
  LOOPBACK_ROAD,
  PIPELINE_TO_FRAME_LEG,
  SSD_ROAD,
  WIFI_ROAD,
  legLength,
  pointAlong,
  type Point,
} from '../routePlan';

export const ROAD_UNITS_PER_SEC = 42;
export const BUILD_SLOWDOWN = 3;
export const FRAME_SLOWDOWN = 40;

export interface TrafficStep {
  points: Point[];
  durationSec: number;
  // Set while the dot waits at a stop, so that stop can light up.
  stop?: number;
  metricId?: string;
}

function road(points: Point[]): TrafficStep {
  return { points, durationSec: legLength(points) / ROAD_UNITS_PER_SEC };
}

function wait(at: Point, stop: number, metricId: string, ms: number, slowdown: number): TrafficStep {
  return { points: [at], durationSec: (ms * slowdown) / 1000, stop, metricId };
}

const lastPoint = (points: Point[]) => points[points.length - 1] as Point;
const buildLeg = (index: number) => (BUILD_LEGS[index] as (typeof BUILD_LEGS)[number]).points;
const frameLeg = (index: number) => (FRAME_LEGS[index] as (typeof FRAME_LEGS)[number]).points;

// A response leaving the dev server for the renderer, passing the network stop on the way.
export function httpTrip(): TrafficStep[] {
  return [road(LOOPBACK_ROAD), road(buildLeg(0))];
}

// A wait that lights no stop: the dev server's file read has a time but isn't one of the 8 stops.
function pause(at: Point, ms: number, slowdown: number): TrafficStep {
  return { points: [at], durationSec: (ms * slowdown) / 1000 };
}

// Starts on the SSD. readMs is null when the dev server's reading for this file hasn't arrived.
export function fetchTrip(ms: number, readMs: number | null): TrafficStep[] {
  return [
    road(SSD_ROAD),
    ...(readMs === null ? [] : [pause(lastPoint(SSD_ROAD), readMs, BUILD_SLOWDOWN)]),
    road(LOOPBACK_ROAD),
    wait(lastPoint(LOOPBACK_ROAD), 1, 'fetchMs', ms, BUILD_SLOWDOWN),
    road(buildLeg(0)),
  ];
}

export function compileTrip(ms: number): TrafficStep[] {
  return [road(buildLeg(1)), road(buildLeg(2)), wait(lastPoint(buildLeg(2)), 4, 'compileMs', ms, BUILD_SLOWDOWN)];
}

export function linkTrip(ms: number): TrafficStep[] {
  return [road(buildLeg(3)), wait(lastPoint(buildLeg(3)), 5, 'linkMs', ms, BUILD_SLOWDOWN)];
}

export function firstDrawTrip(ms: number): TrafficStep[] {
  return [
    wait(lastPoint(buildLeg(3)), 5, 'firstDrawMs', ms, BUILD_SLOWDOWN),
    road(buildLeg(4)),
    road(PIPELINE_TO_FRAME_LEG.points),
  ];
}

// Ends on the display in use, instead of looping back: the next frame gets its own dot.
export function frameTrip(callsMs: number, gpuMs: number, display: 'built-in' | 'lg' | 'unknown'): TrafficStep[] {
  const exit = display === 'lg' ? EXIT_LG_ROAD : display === 'built-in' ? EXIT_BUILT_IN_ROAD : null;
  const atEight = lastPoint(frameLeg(3));
  return [
    wait(frameLeg(0)[0] as Point, 2, 'frameCallsMs', callsMs, FRAME_SLOWDOWN),
    road(frameLeg(0)),
    road(frameLeg(1)),
    wait(lastPoint(frameLeg(1)), 6, 'gpuMs', gpuMs, FRAME_SLOWDOWN),
    road(frameLeg(2)),
    road(frameLeg(3)),
    ...(exit ? [road([atEight, exit[0] as Point, ...exit.slice(1)])] : []),
  ];
}

export function wifiTrip(): TrafficStep[] {
  return [road(WIFI_ROAD)];
}

export interface TripSample {
  position: Point;
  step: TrafficStep;
  stepIndex: number;
}

export function sampleTrip(steps: TrafficStep[], timeSec: number): TripSample | null {
  let remaining = timeSec;
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex] as TrafficStep;
    if (remaining < step.durationSec) {
      return { position: pointAlong(step.points, remaining / step.durationSec), step, stepIndex };
    }
    remaining -= step.durationSec;
  }
  return null;
}

// More traffic means more dots, on a log scale so a large download doesn't flood the road.
export function dotsForBytes(bytes: number, maxDots = 6): number {
  if (bytes < 1) {
    return 0;
  }
  return Math.min(Math.max(1, Math.round(Math.log10(bytes) - 2)), maxDots);
}
