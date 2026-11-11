// Pure road geometry for the two trips in backlog R5. Road length is layout only: no road has a time.

export type Point = [x: number, z: number];
export type RoutePlace = number | 'pipeline';

export interface Leg {
  from: RoutePlace;
  to: RoutePlace;
  points: Point[];
}

export const BUILD_STOPS = [1, 2, 3, 4, 5];
export const FRAME_STOPS = [2, 3, 6, 7, 8];

// The compiled pipeline waits here, on the unified memory ring, between the trips.
export const PIPELINE_POINT: Point = [0, -17];

export const BUILD_LEGS: Leg[] = [
  { from: 1, to: 2, points: [[-22.5, -21.25], [-22.5, -10], [-41, -10], [-41, -4]] },
  { from: 2, to: 3, points: [[-41, -4], [-39, -4]] },
  { from: 3, to: 4, points: [[-39, -4], [-39, -8.5], [-20, -8.5], [-20, -4]] },
  { from: 4, to: 5, points: [[-20, -4], [-18, -4], [-18, -8.5], [-8, -8.5], [-8, -4]] },
  { from: 5, to: 'pipeline', points: [[-8, -4], [-0.6, -4], [-0.6, -17], PIPELINE_POINT] },
];

// Joins the frame loop's return road, so the first frame starts at stop 2 like every later one.
export const PIPELINE_TO_FRAME_LEG: Leg = {
  from: 'pipeline',
  to: 2,
  points: [PIPELINE_POINT, [0.6, -17], [0.6, 1.5], [-36.5, 1.5], [-36.5, -4]],
};

export const FRAME_LEGS: Leg[] = [
  { from: 2, to: 3, points: [[-36.5, -4], [-35, -4]] },
  { from: 3, to: 6, points: [[-35, -4], [-35, 0], [1.5, 0], [1.5, -12.25], [10, -12.25]] },
  { from: 6, to: 7, points: [[10, -12.25], [34, -12.25]] },
  { from: 7, to: 8, points: [[34, -12.25], [42.5, -12.25], [42.5, 9.75], [12, 9.75]] },
  { from: 8, to: 2, points: [[12, 9.75], [8, 9.75], [8, 1.5], [-36.5, 1.5], [-36.5, -4]] },
];

// Off-route and display roads. They carry no timing and aren't part of either trip's order.
// The trip starts at the SSD block. This road ends in the dev server, where the loopback road begins.
export const SSD_ROAD: Point[] = [[36, -26.5], [24, -26.5]];
export const LOOPBACK_ROAD: Point[] = [[24, -26.5], [24, -21.25], [-22.5, -21.25]];
export const WIFI_ROAD: Point[] = [[-34, -24.5], [-34, -21.25], [-22.5, -21.25]];
export const EXIT_BUILT_IN_ROAD: Point[] = [[7, 12.5], [7, 13], [0, 13], [0, 23]];
export const EXIT_LG_ROAD: Point[] = [[17, 12.5], [17, 13], [20, 13], [20, 23]];

// The stops a leg list visits, in order.
export function stopsVisited(legs: Leg[]): RoutePlace[] {
  return legs.length === 0 ? [] : [legs[0].from, ...legs.map((leg) => leg.to)];
}

export function legLength(points: Point[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
  }
  return length;
}

export function pointAlong(points: Point[], progress: number): Point {
  let remaining = Math.min(Math.max(progress, 0), 1) * legLength(points);
  for (let index = 1; index < points.length; index += 1) {
    const [ax, az] = points[index - 1];
    const [bx, bz] = points[index];
    const segment = Math.hypot(bx - ax, bz - az);
    if (remaining <= segment && segment > 0) {
      const t = remaining / segment;
      return [ax + (bx - ax) * t, az + (bz - az) * t];
    }
    remaining -= segment;
  }
  return points[points.length - 1];
}
