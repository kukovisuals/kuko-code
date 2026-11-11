// The dot that travels the roads during replay. It draws over buildings, so it never disappears.
import * as THREE from 'three';
import { COLORS, ROAD_Y } from './palette';
import type { Trip } from './planBuildings';
import type { Point } from './routePlan';

export function createReplayToken() {
  const material = new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), material);
  mesh.renderOrder = 10;
  mesh.visible = false;
  return {
    mesh,
    moveTo([x, z]: Point, trip: Trip) {
      mesh.position.set(x, ROAD_Y + 0.5, z);
      material.color.set(trip === 'build' ? COLORS.oneShot : COLORS.perFrame).lerp(new THREE.Color('#ffffff'), 0.45);
    },
  };
}
