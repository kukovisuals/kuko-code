// The left panel. Every number lives here, so the map itself only carries names.
import { tagChip } from './buildLabels';

export interface PanelSection {
  id: string;
  title: string;
  body: HTMLElement;
  open: boolean;
  chip?: string;
}

export type PanelGroup = 'live' | 'stops' | 'displays' | 'hardware' | 'roads';

const GROUP_TITLES: Record<PanelGroup, string> = {
  live: 'Live',
  stops: 'Pipeline stops',
  displays: 'Displays',
  hardware: 'Hardware map',
  roads: 'Roads',
};

// Below this width the map needs the room more than the numbers do, so the panel starts closed.
const NARROW_WINDOW = '(max-width: 1799px)';

export interface NumbersPanel {
  setGroup(group: PanelGroup, sections: PanelSection[]): void;
  // Reveal opens the panel and the section, for selections made on the map.
  setSelected(id: string | null, reveal: boolean): void;
}

function sectionNode(section: PanelSection, onSelect: (id: string) => void): HTMLElement {
  const details = document.createElement('details');
  details.className = 'panel-section';
  details.dataset.component = section.id;
  details.open = section.open;

  const summary = document.createElement('summary');
  summary.textContent = section.title;
  if (section.chip) {
    summary.append(' ', tagChip(section.chip));
  }
  // The browser toggles the section itself right after this click.
  summary.addEventListener('click', () => onSelect(section.id));
  details.append(summary, section.body);
  return details;
}

export function createNumbersPanel(onSelect: (id: string) => void): NumbersPanel {
  const groups = document.getElementById('panel-groups') as HTMLElement;
  const openButton = document.getElementById('panel-open') as HTMLElement;
  const closeButton = document.getElementById('panel-close') as HTMLElement;

  const setOpen = (open: boolean) => {
    document.body.classList.toggle('panel-open', open);
    openButton.setAttribute('aria-expanded', String(open));
    closeButton.setAttribute('aria-expanded', String(open));
  };
  openButton.addEventListener('click', () => setOpen(true));
  closeButton.addEventListener('click', () => setOpen(false));
  setOpen(!window.matchMedia(NARROW_WINDOW).matches);

  const holders = new Map<PanelGroup, HTMLElement>();
  (Object.keys(GROUP_TITLES) as PanelGroup[]).forEach((group) => {
    const heading = document.createElement('h2');
    heading.textContent = GROUP_TITLES[group];
    const holder = document.createElement('div');
    holders.set(group, holder);
    groups.append(heading, holder);
  });

  let selected: string | null = null;

  const paintSelection = () => {
    groups.querySelectorAll<HTMLElement>('.panel-section').forEach((node) => {
      node.classList.toggle('section-selected', node.dataset.component === selected);
    });
  };

  return {
    setGroup(group, sections) {
      (holders.get(group) as HTMLElement).replaceChildren(...sections.map((section) => sectionNode(section, onSelect)));
      paintSelection();
    },
    setSelected(id, reveal) {
      selected = id;
      paintSelection();
      if (!reveal || id === null) {
        return;
      }
      const node = groups.querySelector<HTMLDetailsElement>(`.panel-section[data-component="${id}"]`);
      if (node) {
        setOpen(true);
        node.open = true;
        node.scrollIntoView({ block: 'nearest' });
      }
    },
  };
}
