import { describe, expect, it } from 'vitest';
import { layoutMap, rectContains, rectsOverlap, siteForStop } from '../src/city/layoutMap';
import { fetchTrip, firstDrawTrip, frameTrip, compileTrip, linkTrip } from '../src/city/live/trafficPlan';
import { SHADER_FORMS } from '../src/city/shaderForms';
import {
  BUILD_LEGS,
  BUILD_STOPS,
  FRAME_LEGS,
  EXIT_LG_ROAD,
  FRAME_STOPS,
  LOOPBACK_ROAD,
  PIPELINE_TO_FRAME_LEG,
  SSD_ROAD,
  pointAlong,
  stopsVisited,
  type Leg,
  type Point,
} from '../src/city/routePlan';

function pointInStop(stop: number, [x, z]: Point): boolean {
  return rectContains(siteForStop(stop), { x, z, w: 0, d: 0 });
}

function expectLegsConnect(legs: Leg[]): void {
  legs.slice(1).forEach((leg, index) => {
    const previous = legs[index].points;
    const previousEnd = previous[previous.length - 1];
    expect(leg.points[0], `${leg.from} to ${leg.to}`).toEqual(previousEnd);
  });
}

function expectLegsReachStops(legs: Leg[]): void {
  for (const leg of legs) {
    if (typeof leg.from === 'number') {
      expect(pointInStop(leg.from, leg.points[0]), `leaves stop ${leg.from}`).toBe(true);
    }
    if (typeof leg.to === 'number') {
      expect(pointInStop(leg.to, leg.points[leg.points.length - 1]), `reaches stop ${leg.to}`).toBe(true);
    }
  }
}

describe('routes', () => {
  it('build trip visits stops 1 to 5 in order, then the pipeline', () => {
    expect(stopsVisited(BUILD_LEGS)).toEqual([...BUILD_STOPS, 'pipeline']);
    expectLegsConnect(BUILD_LEGS);
    expectLegsReachStops(BUILD_LEGS);
  });

  it('frame loop visits 2, 3, 6, 7, 8 in order, then returns to 2', () => {
    expect(stopsVisited(FRAME_LEGS)).toEqual([...FRAME_STOPS, 2]);
    expectLegsConnect(FRAME_LEGS);
    expectLegsReachStops(FRAME_LEGS);
  });

  it('the pipeline road hands off to the frame loop at stop 2', () => {
    expect(PIPELINE_TO_FRAME_LEG.to).toBe(2);
    const end = PIPELINE_TO_FRAME_LEG.points[PIPELINE_TO_FRAME_LEG.points.length - 1];
    expect(end).toEqual(FRAME_LEGS[0].points[0]);
  });

  it('keeps each trip in its own lane of the shared building', () => {
    expect(BUILD_LEGS[1].points.every(([x]) => x < -38)).toBe(true);
    expect(FRAME_LEGS[0].points.every(([x]) => x > -38)).toBe(true);
  });
});

describe('the whole path', () => {
  const [ssd, devServer, pCluster, eCluster, exitLg] = layoutMap(['ssd', 'dev-server', 'p-cluster', 'e-cluster', 'exit-lg']);
  const inside = (block: typeof ssd, [x, z]: Point) => rectContains(block, { x, z, w: 0, d: 0 });
  const end = <T>(items: T[]) => items[items.length - 1] as T;

  it('runs from the SSD block to the dev server, loopback and stop 1 with no gap', () => {
    expect(inside(ssd, SSD_ROAD[0])).toBe(true);
    expect(inside(devServer, end(SSD_ROAD))).toBe(true);
    expect(LOOPBACK_ROAD[0]).toEqual(end(SSD_ROAD));
    expect(pointInStop(1, end(LOOPBACK_ROAD))).toBe(true);
    expect(BUILD_LEGS[0].points[0]).toEqual(end(LOOPBACK_ROAD));
  });

  it('carries a dot from the SSD to a display exit without a jump', () => {
    const trips = [fetchTrip(2, 0.1), compileTrip(5), linkTrip(5), firstDrawTrip(5), frameTrip(0.5, 14, 'lg')];
    const steps = trips.flat();
    expect(steps[0].points[0]).toEqual(SSD_ROAD[0]);
    steps.slice(1).forEach((step, index) => {
      expect(step.points[0], `step ${index + 1}`).toEqual(end(steps[index].points));
    });
    expect(end(end(steps).points)).toEqual(end(EXIT_LG_ROAD));
    expect(inside(exitLg, end(EXIT_LG_ROAD))).toBe(true);
  });

  it('waits at the dev server for the file read, and skips the wait when no reading came', () => {
    expect(fetchTrip(2, 0.1)).toHaveLength(fetchTrip(2, null).length + 1);
  });

  it('never sends a road across a CPU core cluster', () => {
    const roads = [...BUILD_LEGS, ...FRAME_LEGS, PIPELINE_TO_FRAME_LEG].map((leg) => leg.points);
    for (const points of roads) {
      for (let index = 1; index < points.length; index += 1) {
        const [ax, az] = points[index - 1];
        const [bx, bz] = points[index];
        const segment = { x: Math.min(ax, bx), z: Math.min(az, bz), w: Math.abs(bx - ax) || 0.01, d: Math.abs(bz - az) || 0.01 };
        expect(rectsOverlap(segment, pCluster) || rectsOverlap(segment, eCluster)).toBe(false);
      }
    }
  });

  it('names the form of the shader at every stop, and marks the forms no page can read as modeled', () => {
    for (let stop = 1; stop <= 8; stop += 1) {
      expect(SHADER_FORMS[stop]?.form, `stop ${stop}`).toBeTruthy();
      expect(SHADER_FORMS[stop]?.source, `stop ${stop}`).toBeTruthy();
    }
    expect([5, 6, 7, 8].map((stop) => SHADER_FORMS[stop].tag)).toEqual(['modeled', 'modeled', 'modeled', 'modeled']);
    expect([1, 2].map((stop) => SHADER_FORMS[stop].tag)).toEqual(['measured', 'measured']);
  });
});

describe('pointAlong', () => {
  const line: Point[] = [[0, 0], [10, 0], [10, 10]];

  it('walks along the whole polyline', () => {
    expect(pointAlong(line, 0)).toEqual([0, 0]);
    expect(pointAlong(line, 0.5)).toEqual([10, 0]);
    expect(pointAlong(line, 0.75)).toEqual([10, 5]);
    expect(pointAlong(line, 1)).toEqual([10, 10]);
  });

  it('handles a single point', () => {
    expect(pointAlong([[3, 4]], 0.5)).toEqual([3, 4]);
  });
});
