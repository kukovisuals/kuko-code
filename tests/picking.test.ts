import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { componentOf, isClick, pickComponent, tagComponent } from '../src/city/picking';

function box(y: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), new THREE.MeshBasicMaterial());
  mesh.position.y = y;
  return mesh;
}

// Fires straight down from above, so the highest box is the nearest hit.
function pick(scene: THREE.Scene): string | null {
  scene.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 50, 0), new THREE.Vector3(0, -1, 0));
  return pickComponent(raycaster, scene);
}

describe('pickComponent', () => {
  it('returns the nearest tagged mesh', () => {
    const scene = new THREE.Scene();
    scene.add(tagComponent(box(0), 'ground'), tagComponent(box(5), 'tower'));
    expect(pick(scene)).toBe('tower');
  });

  it('passes through untagged meshes', () => {
    const scene = new THREE.Scene();
    scene.add(tagComponent(box(0), 'ground'), box(5));
    expect(pick(scene)).toBe('ground');
  });

  it('skips a tagged mesh inside a hidden group', () => {
    const scene = new THREE.Scene();
    const hidden = new THREE.Group();
    hidden.visible = false;
    hidden.add(tagComponent(box(5), 'tower'));
    scene.add(tagComponent(box(0), 'ground'), hidden);
    expect(pick(scene)).toBe('ground');
  });

  it('hits an invisible pick box, which is how wireframes stay clickable', () => {
    const scene = new THREE.Scene();
    const pickBox = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), new THREE.MeshBasicMaterial({ visible: false }));
    scene.add(tagComponent(pickBox, 'wireframe'));
    expect(pick(scene)).toBe('wireframe');
  });

  it('returns null when nothing is under the ray', () => {
    expect(pick(new THREE.Scene())).toBeNull();
  });
});

describe('componentOf', () => {
  it('finds the tag on a parent', () => {
    const parent = tagComponent(new THREE.Group(), 'roads');
    const child = box(0);
    parent.add(child);
    expect(componentOf(child)).toBe('roads');
  });

  it('prefers the closest tag', () => {
    const parent = tagComponent(new THREE.Group(), 'outer');
    const child = tagComponent(box(0), 'inner');
    parent.add(child);
    expect(componentOf(child)).toBe('inner');
  });
});

describe('isClick', () => {
  it('accepts a small wobble and rejects an orbit drag', () => {
    expect(isClick({ x: 10, y: 10 }, { x: 13, y: 12 })).toBe(true);
    expect(isClick({ x: 10, y: 10 }, { x: 40, y: 10 })).toBe(false);
  });
});
