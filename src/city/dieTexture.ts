// The fine cell pattern on the die: one small canvas, repeated. Decoration only, it carries no data
// and follows no real floorplan.
import * as THREE from 'three';

const SIZE = 64;
// One copy of the pattern covers this many world units.
const TILE_WORLD = 4;

let base: THREE.CanvasTexture | null = null;

function baseTexture(): THREE.CanvasTexture {
  if (base) {
    return base;
  }
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  // White multiplies to the block's own color, so only the lines darken it.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, SIZE, SIZE);
  context.fillStyle = 'rgba(0, 0, 0, 0.16)';
  for (let row = 0; row < SIZE; row += 8) {
    context.fillRect(0, row, SIZE, 2);
  }
  context.fillStyle = 'rgba(0, 0, 0, 0.3)';
  context.fillRect(0, 0, 3, SIZE);
  context.fillRect(0, 0, SIZE, 3);
  base = new THREE.CanvasTexture(canvas);
  base.colorSpace = THREE.SRGBColorSpace;
  base.wrapS = THREE.RepeatWrapping;
  base.wrapT = THREE.RepeatWrapping;
  base.anisotropy = 8;
  return base;
}

// Each block gets its own repeat count, so cells keep one size on blocks of any size.
export function dieTexture(w: number, d: number): THREE.Texture {
  const texture = baseTexture().clone();
  texture.repeat.set(w / TILE_WORLD, d / TILE_WORLD);
  texture.needsUpdate = true;
  return texture;
}
