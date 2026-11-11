// Draws one dot per real event. Build dots run in causal order: each group of dots waits for the group
// before it, so a compile never overtakes the fetch it depends on, however fast the real events came.
import * as THREE from 'three';
import { ROAD_Y } from '../palette';
import { sampleTrip, type TrafficStep } from './trafficPlan';

const CAPACITY = 320;
const START_GAP_SEC = 0.3;
const RIM_SCALE = 1.3;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

export interface DotStyle {
  color: string;
  size: number;
}

interface Dot {
  steps: TrafficStep[];
  clock: number;
  style: DotStyle;
  lastStep: number;
}

interface BuildGroup {
  trips: { steps: TrafficStep[]; style: DotStyle }[];
}

export function createTraffic(onStop: (stop: number, metricId: string) => void) {
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.5, 14, 10),
    new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false }),
    CAPACITY,
  );
  mesh.renderOrder = 10;
  mesh.frustumCulled = false;
  // A slightly larger dark copy behind each dot gives it a rim that reads against any road or tower.
  const rim = new THREE.InstancedMesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color: '#05080c', depthTest: false }),
    CAPACITY,
  );
  rim.renderOrder = 9;
  rim.frustumCulled = false;
  mesh.add(rim);
  mesh.count = CAPACITY;
  // Fills the per-dot color buffer before the first frame.
  mesh.setColorAt(0, new THREE.Color('#ffffff'));

  let dots: Dot[] = [];
  const queue: BuildGroup[] = [];
  let activeBuild: Dot[] = [];
  let groupClock = 0;
  let groupNext = 0;
  let group: BuildGroup | null = null;
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  const launch = (steps: TrafficStep[], style: DotStyle): Dot | null => {
    if (dots.length >= CAPACITY) {
      return null;
    }
    const dot: Dot = { steps, clock: 0, style, lastStep: -1 };
    dots.push(dot);
    return dot;
  };

  const runBuildQueue = (deltaSec: number) => {
    if (group) {
      groupClock += deltaSec;
      while (groupNext < group.trips.length && groupClock >= groupNext * START_GAP_SEC) {
        const trip = group.trips[groupNext] as BuildGroup['trips'][number];
        const dot = launch(trip.steps, trip.style);
        if (dot) {
          activeBuild.push(dot);
        }
        groupNext += 1;
      }
      if (groupNext >= group.trips.length && activeBuild.every((dot) => !dots.includes(dot))) {
        group = null;
        activeBuild = [];
      }
    }
    if (!group && queue.length > 0) {
      group = queue.shift() as BuildGroup;
      groupClock = 0;
      groupNext = 0;
    }
  };

  return {
    mesh,
    spawn(steps: TrafficStep[], style: DotStyle) {
      launch(steps, style);
    },
    enqueueBuild(trips: BuildGroup['trips']) {
      queue.push({ trips });
    },
    // The frame loop starts only after the build trip has finished on screen.
    get buildBusy() {
      return group !== null || queue.length > 0;
    },
    clear() {
      dots = [];
      queue.length = 0;
      group = null;
      activeBuild = [];
    },
    update(deltaSec: number) {
      runBuildQueue(deltaSec);
      dots = dots.filter((dot) => {
        dot.clock += deltaSec;
        return sampleTrip(dot.steps, dot.clock) !== null;
      });
      for (let index = 0; index < CAPACITY; index += 1) {
        const dot = dots[index];
        const sample = dot ? sampleTrip(dot.steps, dot.clock) : null;
        if (!dot || !sample) {
          mesh.setMatrixAt(index, HIDDEN);
          rim.setMatrixAt(index, HIDDEN);
          continue;
        }
        if (sample.stepIndex !== dot.lastStep) {
          dot.lastStep = sample.stepIndex;
          if (sample.step.stop !== undefined && sample.step.metricId) {
            onStop(sample.step.stop, sample.step.metricId);
          }
        }
        matrix.makeScale(dot.style.size, dot.style.size, dot.style.size);
        matrix.setPosition(sample.position[0], ROAD_Y + 0.5, sample.position[1]);
        mesh.setMatrixAt(index, matrix);
        const rimSize = dot.style.size * RIM_SCALE;
        matrix.makeScale(rimSize, rimSize, rimSize);
        matrix.setPosition(sample.position[0], ROAD_Y + 0.5, sample.position[1]);
        rim.setMatrixAt(index, matrix);
        mesh.setColorAt(index, color.set(dot.style.color));
      }
      mesh.instanceMatrix.needsUpdate = true;
      rim.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    },
  };
}
