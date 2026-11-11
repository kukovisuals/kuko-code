// Draws spareRoom's answer: a card on each block with its load and whether the shader can use it, a dark
// cover on idle blocks, and a panel section that leads with the bottleneck verdict.
import * as THREE from 'three';
import type { HardwareEvent } from '../../shared/liveEvents';
import { claimRow, note, numberRow, placeCard, rowsBox, tagChip } from '../buildLabels';
import type { GpuFill } from '../gpuFill';
import { layoutMap } from '../layoutMap';
import type { PanelSection } from '../numbersPanel';
import { BLOCK_HEIGHTS } from '../palette';
import { bottleneck, SPARE_BLOCK_IDS, spareRoom, THRESHOLD_SOURCE, type BlockRoom, type Reach } from './spareRoom';

export const SPARE_SECTION = 'live-spare-room';
// Above the core tiles, so an idle cluster is covered as a whole.
const COVER_LIFT = 0.1;
const REACH_WORDS: Record<Reach, string> = { yes: 'shader runs here', indirectly: 'shader: indirectly', no: 'shader: no' };

function element(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function loadText(room: BlockRoom): string {
  return room.load ? `${room.load.value} ${room.load.unit}` : 'no reading';
}

function drawBlock(group: THREE.Group, blockId: string) {
  const [placed] = layoutMap([blockId]);
  if (!placed) {
    throw new Error(`No slot for ${blockId}`);
  }
  const top = (BLOCK_HEIGHTS[blockId] as number) + COVER_LIFT;
  const geometry = new THREE.PlaneGeometry(placed.w, placed.d);
  geometry.rotateX(-Math.PI / 2);
  const cover = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.6, depthWrite: false }));
  cover.position.set(placed.x + placed.w / 2, top, placed.z + placed.d / 2);
  cover.visible = false;

  const label = element('div', 'name-label spare-card');
  label.dataset.component = SPARE_SECTION;
  // The bottom-right corner is free on every block: names sit top-left, and the GPU reading top-right.
  group.add(cover, placeCard(label, new THREE.Vector3(placed.x + placed.w - 0.2, top, placed.z + placed.d - 0.2), [1, 1]));

  return (room: BlockRoom) => {
    cover.visible = room.idle;
    label.className = `name-label spare-card reach-${room.reach}${room.idle ? ' spare-idle' : ''}`;
    const status = room.idle ? 'idle' : room.load ? 'partial' : 'no reading';
    label.replaceChildren(
      document.createTextNode(`${room.load ? loadText(room) : ''}${room.load ? ' ' : ''}`),
      tagChip(status),
      document.createTextNode(` ${REACH_WORDS[room.reach]}`),
    );
  };
}

function blockRows(room: BlockRoom): HTMLElement[] {
  const load = room.load
    ? numberRow({ name: `${room.name}: load${room.idle ? ', idle' : ''}`, value: room.load.value, unit: room.load.unit, tag: 'partial', source: room.load.source })
    : claimRow(`${room.name}: no reading. ${room.noReading}`, 'no reading', room.noReading ?? 'No reading');
  const reach = claimRow(`Shader can use it: ${room.reach}. ${room.reason}`, room.reasonTag, room.reasonSource);
  reach.classList.add(`reach-${room.reach}`);
  return [load, reach];
}

export function createSpareRoomView() {
  const group = new THREE.Group();
  const painters = new Map(SPARE_BLOCK_IDS.map((id) => [id, drawBlock(group, id)]));

  const body = rowsBox();
  body.append(note('Waiting for the first reading from the dev server.'));
  const section: PanelSection = { id: SPARE_SECTION, title: 'Spare room, and whether the shader can reach it', body, open: true };

  let last: HardwareEvent | null = null;
  let fill: GpuFill | null = null;
  let running = false;

  const paint = () => {
    if (!last) {
      return;
    }
    const current = spareRoom(last);
    current.forEach((room) => painters.get(room.blockId)?.(room));
    const verdict = bottleneck(last, fill, running);
    const lead = claimRow(verdict.text, 'modeled', verdict.source);
    lead.classList.add('spare-verdict');
    body.replaceChildren(
      lead,
      note("A fragment shader only runs on the GPU. An idle block elsewhere is spare room for other work, not for this shader's pixels."),
      ...current.flatMap(blockRows),
      claimRow('Idle and full lines', 'modeled', THRESHOLD_SOURCE),
      note('A block with no reading is never called idle: without a reading, its load is unknown.'),
    );
  };

  return {
    group,
    section,
    update(event: HardwareEvent) {
      last = event;
      paint();
    },
    setProgram(isRunning: boolean, next: GpuFill | null) {
      running = isRunning;
      fill = next;
      paint();
    },
  };
}
