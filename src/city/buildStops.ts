// Turns the building plan into 3D: solid for measured, hatched band for partial, wireframe for modeled.
// Buildings only carry a name on the map. Their numbers go to the panel as sections.
import * as THREE from 'three';
import type { NativeImport, Status } from '../shared/types';
import { nameLabel, note, numberRow, placeCard, rowsBox } from './buildLabels';
import type { PanelSection } from './numbersPanel';
import { COLORS } from './palette';
import { tagComponent } from './picking';
import type { PlannedBuilding, PlannedLane, Trip } from './planBuildings';
import { rowsForStop } from './stopRows';

const DISTRICT_TOP = 0.2;
const MIN_VISIBLE_HEIGHT = 0.12;
const MISSING_STUB_HEIGHT = 0.9;
const NO_HEIGHT_MARKER = 1.6;
// One hatch tile covers this many world units, so stripes keep their size on any face.
const HATCH_TILE = 1.6;
// Every second floor is darker, which separates floors without drawing lines on them.
const FLOOR_TONES = [1, 0.78];
const REST_GLOW = 0.12;
const ACTIVE_GLOW = 0.9;

export interface StopsView {
  group: THREE.Group;
  sections: PanelSection[];
  setActive(metricId: string | null, stop: number | null): void;
}

const tripColor = (trip: Trip) => (trip === 'build' ? COLORS.oneShot : COLORS.perFrame);

function makeHatchTexture(color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.fillStyle = color;
  context.fillRect(0, 0, 64, 64);
  // A dark shade of the same color, because black stripes read as rendering errors.
  context.strokeStyle = new THREE.Color(color).multiplyScalar(0.3).getStyle();
  context.lineWidth = 9;
  for (let offset = -64; offset <= 64; offset += 32) {
    context.beginPath();
    context.moveTo(offset, 64);
    context.lineTo(offset + 64, 0);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Keeps stripes sharp on walls seen at a steep angle. Three clamps this to what the GPU supports.
  texture.anisotropy = 8;
  return texture;
}

const hatchTextures: Partial<Record<Trip, THREE.CanvasTexture>> = {};

function hatchFor(trip: Trip): THREE.CanvasTexture {
  hatchTextures[trip] ??= makeHatchTexture(tripColor(trip));
  return hatchTextures[trip];
}

// Wireframes have no surface to click, so each one carries an invisible box for picking.
function wireBox(w: number, h: number, d: number, color: string): THREE.LineSegments {
  const box = new THREE.BoxGeometry(w, h, d);
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color }));
  lines.add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ visible: false })));
  return lines;
}

// Box faces come in the order +x, -x, +y, -y, +z, -z with 4 corners each. The roof and base stay plain.
function hatchedBoxGeometry(w: number, h: number, d: number): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const uv = geometry.getAttribute('uv');
  [d, d, 0, 0, w, w].forEach((faceWidth, face) => {
    for (let corner = face * 4; corner < face * 4 + 4; corner += 1) {
      uv.setXY(corner, (uv.getX(corner) * faceWidth) / HATCH_TILE, (uv.getY(corner) * h) / HATCH_TILE);
    }
  });
  return geometry;
}

function shadowed<T extends THREE.Mesh>(mesh: T): T {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A floor is a plain segment with the hatched band stacked on top. They share a footprint and never
// overlap, so no two faces sit in the same plane, which is what causes z-fighting.
function drawFloor(
  lane: PlannedLane,
  height: number,
  status: Status,
  baseY: number,
  tone: number,
): { object: THREE.Object3D; lit: THREE.MeshStandardMaterial[] } {
  const inset = 0.25;
  const w = lane.rect.w - inset * 2;
  const d = lane.rect.d - inset * 2;
  const group = new THREE.Group();
  group.position.set(lane.rect.x + lane.rect.w / 2, baseY + height / 2, lane.rect.z + lane.rect.d / 2);

  if (status === 'modeled') {
    group.add(wireBox(w, height, d, tripColor(lane.trip)));
    return { object: group, lit: [] };
  }

  const color = new THREE.Color(tripColor(lane.trip)).multiplyScalar(tone);
  const plain = new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: REST_GLOW });
  const lit = [plain];
  const bandHeight = status === 'partial' ? Math.min(height, Math.max(0.55, height * 0.28)) : 0;
  const bodyHeight = height - bandHeight;

  if (bodyHeight > 0) {
    const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, bodyHeight, d), plain));
    body.position.y = bodyHeight / 2 - height / 2;
    group.add(body);
  }
  if (bandHeight > 0) {
    const map = hatchFor(lane.trip);
    const hatch = new THREE.MeshStandardMaterial({
      map,
      color: new THREE.Color(tone, tone, tone),
      roughness: 0.5,
      emissive: '#ffffff',
      emissiveMap: map,
      emissiveIntensity: REST_GLOW,
    });
    lit.push(hatch);
    const band = shadowed(new THREE.Mesh(hatchedBoxGeometry(w, bandHeight, d), [hatch, hatch, plain, plain, hatch, hatch]));
    band.position.y = height / 2 - bandHeight / 2;
    group.add(band);
  }
  return { object: group, lit };
}

function drawMissingStub(lane: PlannedLane, baseY: number): THREE.Object3D {
  const stub = wireBox(lane.rect.w - 0.5, MISSING_STUB_HEIGHT, lane.rect.d - 0.5, COLORS.ghost);
  stub.position.set(lane.rect.x + lane.rect.w / 2, baseY + MISSING_STUB_HEIGHT / 2, lane.rect.z + lane.rect.d / 2);
  return stub;
}

// Stops 7 and 8 keep a fixed marker, sized so it can't be read as a time.
function drawNoHeightMarker(building: PlannedBuilding): THREE.Object3D {
  const { site } = building;
  const stopNumber = building.stops[0].stop;
  const height = stopNumber === 7 ? NO_HEIGHT_MARKER : 0.06;
  const marker = wireBox(site.w, height, site.d, COLORS.perFrame);
  marker.position.set(site.x + site.w / 2, DISTRICT_TOP + height / 2, site.z + site.d / 2);
  return marker;
}

function buildingId(building: PlannedBuilding): string {
  return `stop-${building.stops.map((stop) => stop.stop).join('+')}`;
}

function buildingSection(building: PlannedBuilding, imports: NativeImport[], invented: boolean): PanelSection {
  const body = rowsBox();
  building.stops.flatMap((stop) => rowsForStop(stop, imports)).forEach((row) => body.append(numberRow(row)));
  if (building.noHeightReason) {
    body.append(note(building.noHeightReason));
  }
  if (building.stops.some((stop) => stop.stop === 3)) {
    body.append(note('Two lanes: build, then frame. roundTripMs is one proxy, shown on both.'));
  }
  return { id: buildingId(building), title: building.title, body, open: true, chip: invented ? 'invented' : undefined };
}

// A wireframe on the map must say it is modeled, even with the panel closed.
function drawsWireframe(building: PlannedBuilding): boolean {
  const metrics = building.stops.flatMap((stop) => stop.metrics);
  const floors = building.lanes.flatMap((lane) => lane.floors);
  return floors.some((floor) => floor.metric.status === 'modeled') || metrics.every((metric) => metric.status === 'modeled');
}

export function buildStops(plan: PlannedBuilding[], imports: NativeImport[], invented: boolean): StopsView {
  const group = new THREE.Group();
  const litByMetric = new Map<string, THREE.MeshStandardMaterial[]>();
  const labels: HTMLElement[] = [];
  const sections: PanelSection[] = [];

  for (const building of plan) {
    const id = buildingId(building);
    const tower = tagComponent(new THREE.Group(), id);
    group.add(tower);
    let tallest = DISTRICT_TOP;
    for (const lane of building.lanes) {
      let y = DISTRICT_TOP;
      lane.floors.forEach((floor, index) => {
        const height = Math.max(floor.height, MIN_VISIBLE_HEIGHT);
        const tone = FLOOR_TONES[index % FLOOR_TONES.length];
        const { object, lit } = drawFloor(lane, height, floor.metric.status, y, tone);
        tower.add(object);
        litByMetric.set(floor.metric.id, [...(litByMetric.get(floor.metric.id) ?? []), ...lit]);
        y += height;
      });
      if (lane.missing.length > 0) {
        tower.add(drawMissingStub(lane, y));
        y += MISSING_STUB_HEIGHT;
      }
      tallest = Math.max(tallest, y);
    }
    if (building.noHeightReason) {
      tower.add(drawNoHeightMarker(building));
      tallest = building.stops[0].stop === 7 ? DISTRICT_TOP + NO_HEIGHT_MARKER : DISTRICT_TOP;
    }
    const section = buildingSection(building, imports, invented);
    section.body.dataset.stops = building.stops.map((stop) => stop.stop).join(',');
    sections.push(section);

    const label = nameLabel(building.title, id, 'stop', drawsWireframe(building) ? 'modeled' : undefined);
    label.dataset.stops = section.body.dataset.stops;
    labels.push(label);
    const anchor = new THREE.Vector3(building.site.x + building.site.w / 2, tallest + 0.3, building.site.z + building.site.d / 2);
    group.add(placeCard(label, anchor, [0.5, 1]));
  }

  const holdsStop = (node: HTMLElement, stop: number | null) =>
    stop !== null && (node.dataset.stops ?? '').split(',').map(Number).includes(stop);

  return {
    group,
    sections,
    setActive(metricId, stop) {
      litByMetric.forEach((materials, id) => {
        materials.forEach((material) => {
          material.emissiveIntensity = id === metricId ? ACTIVE_GLOW : REST_GLOW;
        });
      });
      labels.forEach((node) => node.classList.toggle('name-active', holdsStop(node, stop)));
      sections.forEach(({ body }) => {
        body.classList.toggle('section-active', holdsStop(body, stop));
        body.querySelectorAll<HTMLElement>('.row').forEach((row) => {
          const active = row.dataset.metric === metricId;
          // Follow the replay down the panel, once per row rather than every frame.
          if (active && !row.classList.contains('row-active')) {
            row.scrollIntoView({ block: 'nearest' });
          }
          row.classList.toggle('row-active', active);
        });
      });
    },
  };
}
