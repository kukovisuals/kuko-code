// DOM pieces for the city: name labels placed in 3D through CSS2DRenderer, and the rows of the panel.
// Every number goes through sourcedRow, which refuses to render without a tag and a source.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { formatValue, type SourcedNumber } from './stopRows';

export interface SourceDetail {
  title: string;
  tag: string;
  source: string;
}

export const SOURCE_EVENT = 'city-source';

function element(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

export function tagChip(tag: string): HTMLElement {
  return element('span', `tag tag-${tag.replace(/\s+/g, '-')}`, tag);
}

interface RowInput {
  title: string;
  name: string;
  value: string;
  tag: string;
  source: string;
}

function sourcedRow({ title, name, value, tag, source }: RowInput): HTMLElement {
  if (!tag.trim() || !source.trim()) {
    throw new Error(`Refusing to render "${title}" without a tag and a source`);
  }
  const row = element('div', 'row');
  row.append(element('span', 'row-name', name), element('span', 'row-value', value), tagChip(tag));
  const announce = () => {
    const detail: SourceDetail = { title, tag, source };
    row.dispatchEvent(new CustomEvent(SOURCE_EVENT, { bubbles: true, detail }));
  };
  row.addEventListener('pointerenter', announce);
  row.addEventListener('click', announce);
  return row;
}

export function numberRow(number: SourcedNumber): HTMLElement {
  const value = formatValue(number.value, number.unit);
  const row = sourcedRow({
    title: `${number.name}: ${value}`,
    name: number.name,
    value,
    tag: number.tag,
    source: number.source,
  });
  row.classList.toggle('row-native', Boolean(number.native));
  row.classList.toggle('row-secondary', Boolean(number.secondary));
  row.dataset.metric = number.name;
  return row;
}

// For a sourced statement that has no number, like which engine drives a display.
export function claimRow(text: string, tag: string, source: string): HTMLElement {
  return sourcedRow({ title: text, name: text, value: '', tag, source });
}

// A name on the map, with no numbers. Clicking it selects its component, like clicking the object.
export function nameLabel(text: string, component: string, kind: 'block' | 'stop', chip?: string): HTMLElement {
  const node = element('div', `name-label name-${kind}`, text);
  node.dataset.component = component;
  if (chip) {
    node.append(' ', tagChip(chip));
  }
  return node;
}

export function nameLabelFrom(target: EventTarget | null): string | null {
  const label = target instanceof Element ? target.closest<HTMLElement>('.name-label') : null;
  return label?.dataset.component ?? null;
}

export function paintSelectedLabels(component: string | null): void {
  document.querySelectorAll<HTMLElement>('.name-label').forEach((node) => {
    node.classList.toggle('name-selected', node.dataset.component === component);
  });
}

export function rowsBox(): HTMLElement {
  return element('div', 'section-body');
}

export function card(className: string, title?: string): HTMLElement {
  const node = element('div', `card ${className}`);
  if (title) {
    node.append(element('div', 'card-title', title));
  }
  return node;
}

export function note(text: string, className = 'card-note'): HTMLElement {
  return element('div', className, text);
}

// Anchor (0, 0) puts the card's top-left corner on the point, and (0.5, 1) centers it above.
export function placeCard(node: HTMLElement, position: THREE.Vector3, anchor: [number, number]): CSS2DObject {
  const object = new CSS2DObject(node);
  object.position.copy(position);
  object.center.set(anchor[0], anchor[1]);
  return object;
}
