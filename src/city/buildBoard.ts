// The logic board around the chip: a board, the package substrate and small parts on the board.
// Decoration only. Nothing here is a hardware-map block, carries a number or can be clicked.
import * as THREE from 'three';
import { layoutMap, type Rect } from './layoutMap';
import { BOARD_Y, COLORS } from './palette';

const BOARD: Rect = { x: -60, z: -37, w: 120, d: 72 };
const SUBSTRATE_MARGIN = 1.2;
const SUBSTRATE_TOP = 0.05;

// Empty board areas, clear of every block, road and label on the map.
const PART_ZONES: Rect[] = [
  { x: -58, z: -16, w: 8, d: 36 },
  { x: 50, z: -16, w: 8, d: 36 },
  { x: -58, z: -35.5, w: 116, d: 4 },
  { x: -44, z: 25, w: 32, d: 8 },
  { x: 32, z: 25, w: 26, d: 8 },
];
const PITCH_X = 2;
const PITCH_Z = 1.6;

interface Part {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
}

// The larger packages: two black chips and one shielded can.
const BIG_PARTS: Part[] = [
  { x: -53, z: 29, w: 7, h: 0.5, d: 6, color: COLORS.chipPackage },
  { x: 54, z: -25, w: 6, h: 0.5, d: 6, color: COLORS.chipPackage },
  { x: -53, z: -25, w: 7, h: 0.7, d: 5, color: COLORS.shieldCan },
];

// A fixed pseudo-random number from 0 to 1 per grid cell, so the board looks the same on every load.
function cellNoise(column: number, row: number, zone: number): number {
  const value = Math.sin(column * 12.9898 + row * 78.233 + zone * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

// A capacitor is a tan body with a solder cap on each end.
function capacitor(x: number, z: number): Part[] {
  return [
    { x, z, w: 0.6, h: 0.32, d: 0.5, color: COLORS.capacitor },
    { x: x - 0.4, z, w: 0.2, h: 0.34, d: 0.52, color: COLORS.solder },
    { x: x + 0.4, z, w: 0.2, h: 0.34, d: 0.52, color: COLORS.solder },
  ];
}

function smallParts(): Part[] {
  const parts: Part[] = [];
  PART_ZONES.forEach((zone, zoneIndex) => {
    for (let column = 0; column * PITCH_X + 1 < zone.w; column += 1) {
      for (let row = 0; row * PITCH_Z + 1 < zone.d; row += 1) {
        const x = zone.x + 1 + column * PITCH_X;
        const z = zone.z + 0.8 + row * PITCH_Z;
        const roll = cellNoise(column, row, zoneIndex);
        if (roll < 0.5) {
          parts.push(...capacitor(x, z));
        } else if (roll < 0.65) {
          parts.push({ x, z, w: 1.2, h: 0.22, d: 0.9, color: COLORS.chipPackage });
        }
      }
    }
  });
  return parts;
}

function slab(rect: Rect, top: number, thickness: number, color: string): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(rect.w, thickness, rect.d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  mesh.position.set(rect.x + rect.w / 2, top - thickness / 2, rect.z + rect.d / 2);
  mesh.receiveShadow = true;
  return mesh;
}

// Every part is one copy of the same unit box, so the whole board costs a single draw call.
function drawParts(parts: Part[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.6 }),
    parts.length,
  );
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  parts.forEach((part, index) => {
    matrix.makeScale(part.w, part.h, part.d);
    matrix.setPosition(part.x, BOARD_Y + part.h / 2, part.z);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, color.set(part.color));
  });
  return mesh;
}

export function buildBoard(): THREE.Group {
  const group = new THREE.Group();
  const [ring] = layoutMap(['memory-ring']);
  const substrate: Rect = {
    x: ring.x - SUBSTRATE_MARGIN,
    z: ring.z - SUBSTRATE_MARGIN,
    w: ring.w + SUBSTRATE_MARGIN * 2,
    d: ring.d + SUBSTRATE_MARGIN * 2,
  };
  group.add(
    slab(BOARD, BOARD_Y, 0.6, COLORS.board),
    slab(substrate, SUBSTRATE_TOP, SUBSTRATE_TOP - BOARD_Y, COLORS.substrate),
    drawParts([...BIG_PARTS, ...smallParts()]),
  );
  return group;
}
