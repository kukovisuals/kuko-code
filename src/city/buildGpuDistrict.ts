// 10 cores lit together with a modeled fill, plus the modeled stop 7 view of one core.
// A page has no per-core counters, so per-core lighting would be fiction (F7).
import * as THREE from 'three';
import type { HardwareMap, SpecNumber } from '../shared/types';
import { card, note, numberRow, placeCard, rowsBox, tagChip } from './buildLabels';
import type { GpuFill } from './gpuFill';
import { layoutGpuCores, type Rect } from './layoutMap';
import type { PanelSection } from './numbersPanel';
import { COLORS } from './palette';
import { tagComponent } from './picking';

const CORE_TOP = 0.3;
const ZOOM_Y = 15;
const CELL = 0.7;
const CELL_GAP = 0.08;

export interface GpuDistrictView {
  group: THREE.Group;
  zoomFocus: THREE.Vector3;
  fillSection: PanelSection;
  setFill(fill: GpuFill | null): void;
  // The real reading for the whole GPU. All cores share it, because macOS gives no per-core number.
  setLivePercent(percent: number | null): void;
  setZoomVisible(visible: boolean): void;
}

function specNumber(map: HardwareMap, name: string): SpecNumber {
  const number = map.blocks.find((block) => block.id === 'gpu-core')?.numbers.find((entry) => entry.name === name);
  if (!number) {
    throw new Error(`Hardware map has no gpu-core number "${name}"`);
  }
  return number;
}

function coreCount(map: HardwareMap): number {
  const number = map.blocks.find((block) => block.id === 'gpu')?.numbers.find((entry) => entry.name === 'Cores');
  if (!number) {
    throw new Error('Hardware map has no GPU core count');
  }
  return number.value;
}

function rectOutline(x: number, z: number, w: number, d: number): number[] {
  const y = 0;
  return [
    x, y, z, x + w, y, z,
    x + w, y, z, x + w, y, z + d,
    x + w, y, z + d, x, y, z + d,
    x, y, z + d, x, y, z,
  ];
}

// One core as lanes x threads. Lane 0 is drawn in the per-frame color as one dispatching group.
function drawLaneGrid(lanes: number, threads: number): THREE.Group {
  const group = new THREE.Group();
  const pitch = CELL + CELL_GAP;
  const dim: number[] = [];
  const lit: number[] = [];
  for (let lane = 0; lane < lanes; lane += 1) {
    for (let thread = 0; thread < threads; thread += 1) {
      const target = lane === 0 ? lit : dim;
      target.push(...rectOutline(thread * pitch - (threads * pitch) / 2, lane * pitch * 2, CELL, CELL));
    }
  }
  const lines = (positions: number[], color: string) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color }));
  };
  group.add(lines(dim, COLORS.ghost), lines(lit, COLORS.perFrame));
  return group;
}

function zoomCard(map: HardwareMap): HTMLElement {
  const node = card('zoom-card', 'Stop 7: inside one GPU core');
  node.append(tagChip('modeled'));
  ['Dispatch lanes', 'SIMD group', 'ALUs per core'].forEach((name) => {
    const number = specNumber(map, name);
    node.append(numberRow({ name, value: number.value, unit: number.unit, tag: number.basis, source: number.source }));
  });
  node.append(
    note('The 4 means per-cycle dispatch, not how many groups a core can hold (metal-benchmarks lists 12 to 96).'),
    note('No time of its own: stop 6 already includes this work, so GPU time is never counted twice.'),
    note('Bright row: one 32-thread SIMD group. The driver picks tile size, so this drawing is modeled.'),
  );
  return node;
}

export function buildGpuDistrict(map: HardwareMap, coresArea: Rect): GpuDistrictView {
  const group = new THREE.Group();
  const cores = layoutGpuCores(coresArea, coreCount(map));
  const fillMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.perFrame,
    emissive: COLORS.perFrame,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.9,
  });
  const fills = cores.map((core) => {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(core.w, 0.08, core.d),
      new THREE.MeshStandardMaterial({ color: '#3a3268', roughness: 0.7 }),
    );
    pad.position.set(core.x + core.w / 2, CORE_TOP, core.z + core.d / 2);
    pad.receiveShadow = true;
    group.add(tagComponent(pad, 'gpu-core'));

    const fill = new THREE.Mesh(new THREE.BoxGeometry(core.w, 0.05, core.d), fillMaterial);
    // The box's left edge stays on the core's left edge as it scales along x.
    fill.geometry.translate(core.w / 2, 0, 0);
    fill.position.set(core.x, CORE_TOP + 0.07, core.z + core.d / 2);
    group.add(tagComponent(fill, 'gpu-fill'));
    return fill;
  });

  const fillBody = rowsBox();
  const fillText = note('No recording loaded');
  fillBody.append(fillText);

  const lanes = specNumber(map, 'Dispatch lanes').value;
  const threads = specNumber(map, 'SIMD group').value;
  const zoom = new THREE.Group();
  const focusCore = cores[7];
  const zoomCenter = new THREE.Vector3(focusCore.x + focusCore.w / 2, ZOOM_Y, focusCore.z + focusCore.d / 2);
  zoom.position.copy(zoomCenter);
  zoom.add(drawLaneGrid(lanes, threads));
  const tether = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, CORE_TOP - ZOOM_Y, 0)]);
  zoom.add(new THREE.LineSegments(tether, new THREE.LineBasicMaterial({ color: COLORS.ghost })));
  const zoomLabel = placeCard(zoomCard(map), new THREE.Vector3(0, 0, -1), [0.5, 1]);
  zoom.add(zoomLabel);
  zoom.visible = false;
  group.add(zoom);

  return {
    group,
    zoomFocus: zoomCenter,
    fillSection: { id: 'gpu-fill', title: 'GPU share of frame', body: fillBody, open: true, chip: 'modeled' },
    setFill(fill) {
      fills.forEach((mesh) => {
        mesh.visible = fill !== null && fill.fill > 0;
        mesh.scale.x = Math.max(fill?.fill ?? 0, 0.001);
      });
      fillText.textContent = fill
        ? `${fill.gpuMs.toFixed(2)} ms / ${fill.budgetMs.toFixed(2)} ms budget = ${fill.percent.toFixed(1)}%. All 10 cores share one number.`
        : 'No gpuMs value to show';
    },
    setLivePercent(percent) {
      fills.forEach((mesh) => {
        mesh.visible = percent !== null && percent > 0;
        mesh.scale.x = Math.max((percent ?? 0) / 100, 0.001);
      });
    },
    setZoomVisible(visible) {
      zoom.visible = visible;
      zoomLabel.element.style.display = visible ? '' : 'none';
    },
  };
}
