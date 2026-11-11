import { describe, expect, it } from 'vitest';
import { rectContains, siteForStop } from '../src/city/layoutMap';
import {
  BUILD_LEGS,
  BUILD_STOPS,
  FRAME_LEGS,
  FRAME_STOPS,
  PIPELINE_TO_FRAME_LEG,
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
