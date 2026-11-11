// Finds which city component sits under the mouse. Pure scene logic, so it runs in tests without a GPU.
import * as THREE from 'three';

// A drag that moves further than this is an orbit, not a click.
const CLICK_SLOP_PX = 5;

export function tagComponent<T extends THREE.Object3D>(object: T, id: string): T {
  object.userData.component = id;
  return object;
}

export function isClick(down: { x: number; y: number }, up: { x: number; y: number }): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) <= CLICK_SLOP_PX;
}

// The nearest tag walking up the parents. Raycasts also hit hidden objects, so anything hidden returns null.
export function componentOf(object: THREE.Object3D): string | null {
  let found: string | null = null;
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (!node.visible) {
      return null;
    }
    found ??= (node.userData.component as string | undefined) ?? null;
  }
  return found;
}

// Only meshes count, because wireframes carry an invisible pick box. Untagged meshes let the ray pass through.
export function pickComponent(raycaster: THREE.Raycaster, scene: THREE.Object3D): string | null {
  for (const hit of raycaster.intersectObject(scene, true)) {
    const id = hit.object instanceof THREE.Mesh ? componentOf(hit.object) : null;
    if (id) {
      return id;
    }
  }
  return null;
}
