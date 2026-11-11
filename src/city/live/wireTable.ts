// The capture table under the map. It keeps following new rows until you scroll up to read one.
import { SOURCE_EVENT, tagChip, type SourceDetail } from '../buildLabels';
import type { WireGroup, WireRow } from './wireRows';

const MAX_ROWS = 400;
const NEAR_BOTTOM_PX = 24;

function cell(text: string, className: string): HTMLElement {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  return node;
}

export function createWireTable(onSelect: (component: string) => void) {
  const body = document.getElementById('wire-rows') as HTMLElement;
  const counter = document.getElementById('wire-count') as HTMLElement;
  // Counts from when the page began to load, so its own file requests get real times too.
  const startedAt = performance.timeOrigin;
  const hidden = new Set<WireGroup>();
  let total = 0;
  const note = document.getElementById('wire-note') as HTMLElement;
  const defaultNote = note.textContent;
  body.addEventListener('pointerleave', () => {
    note.textContent = defaultNote;
  });

  document.querySelectorAll<HTMLButtonElement>('[data-wire-filter]').forEach((button) => {
    if (button.getAttribute('aria-pressed') === 'false') {
      hidden.add(button.dataset.wireFilter as WireGroup);
    }
    button.addEventListener('click', () => {
      const group = button.dataset.wireFilter as WireGroup;
      const isOn = hidden.has(group);
      if (isOn) {
        hidden.delete(group);
      } else {
        hidden.add(group);
      }
      button.setAttribute('aria-pressed', String(isOn));
      body.querySelectorAll<HTMLElement>(`[data-group="${group}"]`).forEach((row) => {
        row.hidden = !isOn;
      });
    });
  });

  return {
    add(row: WireRow) {
      const following = body.scrollHeight - body.scrollTop - body.clientHeight < NEAR_BOTTOM_PX;
      const node = document.createElement('div');
      node.className = `wire-row wire-${row.group}`;
      node.dataset.group = row.group;
      node.hidden = hidden.has(row.group);
      const seconds = ((row.at - startedAt) / 1000).toFixed(3);
      node.append(
        cell(seconds, 'wire-time'),
        cell(row.from, 'wire-from'),
        cell(row.to, 'wire-to'),
        cell(row.protocol, 'wire-protocol'),
        cell(row.length, 'wire-length'),
        cell(row.info, 'wire-info'),
        tagChip(row.status),
      );
      const detail: SourceDetail = { title: `${row.protocol}: ${row.info}`, tag: row.status, source: row.source };
      const announce = () => {
        note.textContent = `Source: ${row.source}`;
        node.dispatchEvent(new CustomEvent(SOURCE_EVENT, { bubbles: true, detail }));
      };
      node.addEventListener('pointerenter', announce);
      node.addEventListener('click', () => {
        announce();
        if (row.component) {
          onSelect(row.component);
        }
      });
      body.append(node);
      if (body.childElementCount > MAX_ROWS) {
        body.firstElementChild?.remove();
      }
      total += 1;
      counter.textContent = `${total.toLocaleString('en-US')} events`;
      if (following) {
        body.scrollTop = body.scrollHeight;
      }
    },
    clear() {
      body.replaceChildren();
    },
  };
}
