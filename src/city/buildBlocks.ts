// Draws the hardware map as the ground of the city. No timing data lives here.
import * as THREE from 'three';
import type { Block, HardwareMap } from '../shared/types';
import { claimRow, nameLabel, note, numberRow, placeCard, rowsBox, tagChip } from './buildLabels';
import { layoutMap, type PlacedBlock } from './layoutMap';
import { MAP_CLAIMS } from './mapClaims';
import type { PanelSection } from './numbersPanel';
import { BLOCK_COLORS, BLOCK_HEIGHTS, CHIP_FLOOR_Y, COLORS } from './palette';
import { tagComponent } from './picking';

const RING_THICKNESS = 2;

// Pushes block surfaces slightly back in depth, so outlines drawn exactly on their edges always win.
const BEHIND_OUTLINE = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };

// Short names for the map. The panel keeps the full labels from the hardware map.
const MAP_NAMES: Record<string, string> = {
  wifi: 'Wi-Fi',
  'dev-server': 'Dev server',
  cpu: 'CPU',
  gpu: 'GPU',
  'neural-engine': 'Neural Engine',
  'media-engine': 'Media engine',
  'display-engines': 'Display engines',
};

// The fill drawn on the cores is modeled, and must say so even with the panel closed.
const MAP_CHIPS: Record<string, string> = {
  'gpu-core': 'fill modeled',
};

const DISPLAY_IDS = ['exit-built-in', 'exit-lg'];

// These describe the road leaving each block.
const ROAD_NOTES: Record<string, string> = {
  wifi: 'Dimmed road: unused by local files',
  'dev-server': 'Lit road: loopback, serves ./shaders',
};

export interface ExitHandle {
  screen: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  label: HTMLElement;
  body: HTMLElement;
}

export interface BlocksView {
  group: THREE.Group;
  exits: Record<'built-in' | 'lg', ExitHandle>;
  // The drawn core fill changes meaning between a recording and the live reading, so its chip must too.
  setCoresChip(chip: string): void;
  cores: PlacedBlock;
  displaySections: PanelSection[];
  hardwareSections: PanelSection[];
}

function outline(geometry: THREE.BufferGeometry, offChip: boolean): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(geometry);
  const material = offChip
    ? new THREE.LineDashedMaterial({ color: COLORS.outline, dashSize: 0.6, gapSize: 0.4 })
    : new THREE.LineBasicMaterial({ color: COLORS.outline });
  const lines = new THREE.LineSegments(edges, material);
  if (offChip) {
    lines.computeLineDistances();
  }
  return lines;
}

function drawBox(placed: PlacedBlock, offChip: boolean): THREE.Mesh {
  const height = BLOCK_HEIGHTS[placed.id];
  const geometry = new THREE.BoxGeometry(placed.w, height, placed.d);
  const material = new THREE.MeshStandardMaterial({ color: BLOCK_COLORS[placed.id], roughness: 0.85, ...BEHIND_OUTLINE });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(placed.x + placed.w / 2, height / 2, placed.z + placed.d / 2);
  mesh.receiveShadow = true;
  mesh.add(outline(geometry, offChip));
  return mesh;
}

// The ring is a frame with a hole. Its inside gets a thin floor, so blocks sit on a chip surface.
function drawRing(placed: PlacedBlock): THREE.Group {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(placed.x, placed.z);
  shape.lineTo(placed.x + placed.w, placed.z);
  shape.lineTo(placed.x + placed.w, placed.z + placed.d);
  shape.lineTo(placed.x, placed.z + placed.d);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(placed.x + RING_THICKNESS, placed.z + RING_THICKNESS);
  hole.lineTo(placed.x + RING_THICKNESS, placed.z + placed.d - RING_THICKNESS);
  hole.lineTo(placed.x + placed.w - RING_THICKNESS, placed.z + placed.d - RING_THICKNESS);
  hole.lineTo(placed.x + placed.w - RING_THICKNESS, placed.z + RING_THICKNESS);
  hole.closePath();
  shape.holes.push(hole);

  const height = BLOCK_HEIGHTS[placed.id];
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  // Extrusion runs along z and the shape lies in x-y, so this turns it flat and keeps z as z.
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, height, 0);
  const ring = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: BLOCK_COLORS[placed.id], roughness: 0.6, side: THREE.DoubleSide, ...BEHIND_OUTLINE }),
  );
  ring.receiveShadow = true;
  ring.add(outline(geometry, false));
  tagComponent(ring, placed.id);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(placed.w - RING_THICKNESS, CHIP_FLOOR_Y, placed.d - RING_THICKNESS),
    new THREE.MeshStandardMaterial({ color: '#0e141b', roughness: 0.95 }),
  );
  floor.position.set(placed.x + placed.w / 2, CHIP_FLOOR_Y / 2, placed.z + placed.d / 2);
  floor.receiveShadow = true;
  group.add(ring, floor);
  return group;
}

function blockSection(block: Block): PanelSection {
  const body = rowsBox();
  if (ROAD_NOTES[block.id]) {
    body.append(note(ROAD_NOTES[block.id]));
  }
  block.numbers.forEach((number) => {
    body.append(
      numberRow({ name: number.name, value: number.value, unit: number.unit, tag: number.basis, source: number.source }),
    );
  });
  MAP_CLAIMS.filter((claim) => claim.blockId === block.id).forEach((claim) => {
    body.append(claimRow(claim.text, claim.tag, claim.source));
  });
  if (body.childElementCount === 0) {
    body.append(note('The hardware map lists no numbers for this block.'));
  }
  // Both exits always show their speed limit, so they start open.
  return { id: block.id, title: block.label, body, open: DISPLAY_IDS.includes(block.id) };
}

function drawExitScreen(placed: PlacedBlock): ExitHandle['screen'] {
  const material = new THREE.MeshStandardMaterial({ color: '#10181f', emissive: COLORS.perFrame, emissiveIntensity: 0.08 });
  const screen = new THREE.Mesh(new THREE.BoxGeometry(placed.w - 1.5, 3.2, 0.3), material);
  screen.position.set(placed.x + placed.w / 2, 0.3 + 1.6, placed.z + 0.4);
  screen.castShadow = true;
  tagComponent(screen, placed.id);
  return screen;
}

// Districts and the ring label their outer edge, so their names don't sit on their children's.
function labelSpot(id: string, placed: PlacedBlock): { position: THREE.Vector3; anchor: [number, number] } {
  const top = BLOCK_HEIGHTS[id];
  if (id === 'memory-ring') {
    return { position: new THREE.Vector3(-18, top, placed.z), anchor: [0, 1] };
  }
  if (id === 'cpu') {
    return { position: new THREE.Vector3(placed.x, top, placed.z + 0.1), anchor: [0, 1] };
  }
  if (id === 'gpu') {
    return { position: new THREE.Vector3(placed.x + placed.w, top, placed.z + 0.1), anchor: [1, 1] };
  }
  // These two names move clear of what stands on their block: tower 6's label and tower 4.
  if (id === 'network-road') {
    return { position: new THREE.Vector3(-12, top, placed.z), anchor: [0, 0] };
  }
  if (id === 'e-cluster') {
    return { position: new THREE.Vector3(-15.5, top, placed.z + 0.2), anchor: [0, 0] };
  }
  // Above the cores, because the fill bars are too bright to read text on.
  if (id === 'gpu-core') {
    return { position: new THREE.Vector3(placed.x + 0.25, top, placed.z), anchor: [0, 1] };
  }
  const isExit = id === 'exit-built-in' || id === 'exit-lg';
  return { position: new THREE.Vector3(placed.x + 0.25, top, placed.z + (isExit ? 0.9 : 0.2)), anchor: [0, 0] };
}

export function buildBlocks(map: HardwareMap): BlocksView {
  const group = new THREE.Group();
  const placedById = new Map(layoutMap(map.blocks.map((block) => block.id)).map((placed) => [placed.id, placed]));
  const labelsById = new Map<string, HTMLElement>();
  const sections = map.blocks.map(blockSection);

  for (const block of map.blocks) {
    const placed = placedById.get(block.id) as PlacedBlock;
    group.add(block.id === 'memory-ring' ? drawRing(placed) : tagComponent(drawBox(placed, block.offChip), block.id));
    const label = nameLabel(MAP_NAMES[block.id] ?? block.label, block.id, 'block', MAP_CHIPS[block.id]);
    labelsById.set(block.id, label);
    const spot = labelSpot(block.id, placed);
    group.add(placeCard(label, spot.position, spot.anchor));
  }

  const exitHandle = (id: string): ExitHandle => {
    const screen = drawExitScreen(placedById.get(id) as PlacedBlock);
    group.add(screen);
    const section = sections.find((entry) => entry.id === id) as PanelSection;
    return { screen, label: labelsById.get(id) as HTMLElement, body: section.body };
  };

  return {
    group,
    exits: { 'built-in': exitHandle('exit-built-in'), lg: exitHandle('exit-lg') },
    setCoresChip(chip) {
      labelsById.get('gpu-core')?.querySelector('.tag')?.replaceWith(tagChip(chip));
    },
    cores: placedById.get('gpu-core') as PlacedBlock,
    displaySections: sections.filter((section) => DISPLAY_IDS.includes(section.id)),
    hardwareSections: sections.filter((section) => !DISPLAY_IDS.includes(section.id)),
  };
}
