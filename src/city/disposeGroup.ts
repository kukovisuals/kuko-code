import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Removes a group from the scene and frees its GPU buffers and DOM labels.
export function disposeGroup(group: THREE.Object3D): void {
  group.parent?.remove(group);
  group.traverse((object) => {
    if (object instanceof CSS2DObject) {
      object.element.remove();
    }
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
      const materials: THREE.Material[] = [object.material].flat();
      materials.forEach((material) => material.dispose());
    }
  });
}
