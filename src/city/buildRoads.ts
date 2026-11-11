// Draws both trips as ribbons on the ground. Roads carry no timing, and road length means nothing.
import * as THREE from 'three';
import { nameLabel, note, placeCard, rowsBox } from './buildLabels';
import type { PanelSection } from './numbersPanel';
import { COLORS, ROAD_Y } from './palette';
import { tagComponent } from './picking';
import {
  BUILD_LEGS,
  EXIT_BUILT_IN_ROAD,
  EXIT_LG_ROAD,
  FRAME_LEGS,
  LOOPBACK_ROAD,
  PIPELINE_POINT,
  PIPELINE_TO_FRAME_LEG,
  WIFI_ROAD,
  legLength,
  pointAlong,
  type Point,
} from './routePlan';

const ROAD_WIDTH = 0.42;
const ARROW_SPACING = 5;

export interface RoadsView {
  group: THREE.Group;
  section: PanelSection;
  setActiveExit(display: 'built-in' | 'lg' | null): void;
}

function ribbon(points: Point[], color: string, width: number, opacity = 1): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
  for (let index = 1; index < points.length; index += 1) {
    const [ax, az] = points[index - 1];
    const [bx, bz] = points[index];
    const length = Math.hypot(bx - ax, bz - az);
    // Each segment runs a little long, so corners stay closed.
    const piece = new THREE.Mesh(new THREE.BoxGeometry(length + width, 0.04, width), material);
    piece.position.set((ax + bx) / 2, ROAD_Y, (az + bz) / 2);
    piece.rotation.y = -Math.atan2(bz - az, bx - ax);
    group.add(piece);
  }
  return group;
}

function dashedRibbon(points: Point[], color: string, width: number, opacity = 1): THREE.Group {
  const group = new THREE.Group();
  const length = legLength(points);
  const dash = 0.9;
  for (let at = 0; at < length; at += dash * 2) {
    const from = pointAlong(points, at / length);
    const to = pointAlong(points, Math.min((at + dash) / length, 1));
    group.add(ribbon([from, to], color, width, opacity));
  }
  return group;
}

function arrows(points: Point[], color: string): THREE.Group {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0.6, 0);
  shape.lineTo(-0.4, 0.5);
  shape.lineTo(-0.4, -0.5);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  const length = legLength(points);
  for (let at = ARROW_SPACING / 2; at < length; at += ARROW_SPACING) {
    const [x, z] = pointAlong(points, at / length);
    const [nextX, nextZ] = pointAlong(points, Math.min((at + 0.05) / length, 1));
    const arrow = new THREE.Mesh(geometry, material);
    arrow.position.set(x, ROAD_Y + 0.05, z);
    arrow.rotation.y = -Math.atan2(nextZ - z, nextX - x);
    group.add(arrow);
  }
  return group;
}

function roadsSection(): PanelSection {
  const body = rowsBox();
  body.append(
    note('Compiled pipeline: waits in memory between trips.'),
    note('Next rAF: the frame loop returns to stop 2.'),
    note('Roads carry no timing, and road length means nothing.'),
  );
  return { id: 'roads', title: 'Roads and pipeline', body, open: false };
}

function drawPipelineMarker(): THREE.Object3D {
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 1.2, 6),
    new THREE.MeshStandardMaterial({ color: '#d9e2ec', roughness: 0.35, emissive: '#7aa2c8', emissiveIntensity: 0.35 }),
  );
  marker.position.set(PIPELINE_POINT[0], 0.45 + 0.6, PIPELINE_POINT[1]);
  marker.castShadow = true;
  return marker;
}

export function buildRoads(): RoadsView {
  const group = tagComponent(new THREE.Group(), 'roads');

  const buildPoints = BUILD_LEGS.map((leg) => leg.points);
  const framePoints = [...FRAME_LEGS.map((leg) => leg.points)];
  buildPoints.forEach((points) => {
    group.add(ribbon(points, COLORS.oneShot, ROAD_WIDTH), arrows(points, COLORS.oneShot));
  });
  framePoints.forEach((points) => {
    group.add(ribbon(points, COLORS.perFrame, ROAD_WIDTH), arrows(points, COLORS.perFrame));
  });
  group.add(dashedRibbon(PIPELINE_TO_FRAME_LEG.points, COLORS.perFrame, ROAD_WIDTH));

  group.add(ribbon(LOOPBACK_ROAD, COLORS.oneShot, ROAD_WIDTH), arrows(LOOPBACK_ROAD, COLORS.oneShot));
  group.add(dashedRibbon(WIFI_ROAD, COLORS.wifiDim, ROAD_WIDTH * 0.8, 0.85));

  const exitRoads = {
    'built-in': ribbon(EXIT_BUILT_IN_ROAD, COLORS.perFrame, ROAD_WIDTH * 0.8, 0.28),
    lg: ribbon(EXIT_LG_ROAD, COLORS.perFrame, ROAD_WIDTH * 0.8, 0.28),
  };
  group.add(exitRoads['built-in'], exitRoads.lg);

  group.add(drawPipelineMarker());
  const pipelineLabel = placeCard(nameLabel('Compiled pipeline', 'roads', 'block'), new THREE.Vector3(1.4, 1.2, PIPELINE_POINT[1]), [0, 0.5]);
  group.add(pipelineLabel);

  return {
    group,
    section: roadsSection(),
    setActiveExit(display) {
      (['built-in', 'lg'] as const).forEach((id) => {
        const active = id === display;
        exitRoads[id].traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.material.opacity = active ? 1 : 0.28;
          }
        });
      });
    },
  };
}
