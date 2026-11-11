// The flat page controls around the 3D view. Holds no recording state of its own.
import { SOURCE_EVENT, type SourceDetail } from './buildLabels';

export interface HudHandlers {
  onFiles(files: File[]): void;
  onPreview(): void;
  onSwap(): void;
  onReplay(): void;
  onZoom(): void;
  onToggleProgram(): void;
  onRestartProgram(): void;
}

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Page is missing #${id}`);
  }
  return node as T;
}

function fillList(node: HTMLElement, items: string[]): void {
  node.replaceChildren(
    ...items.map((item) => {
      const entry = document.createElement('li');
      entry.textContent = item;
      return entry;
    }),
  );
  node.hidden = items.length === 0;
}

export function createHud(handlers: HudHandlers) {
  const fileInput = byId<HTMLInputElement>('file-input');
  byId('load').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    handlers.onFiles([...(fileInput.files ?? [])]);
    fileInput.value = '';
  });
  byId('preview').addEventListener('click', handlers.onPreview);
  byId('swap').addEventListener('click', handlers.onSwap);
  byId('replay').addEventListener('click', handlers.onReplay);
  byId('zoom').addEventListener('click', handlers.onZoom);
  byId('program-toggle').addEventListener('click', handlers.onToggleProgram);
  byId('program-restart').addEventListener('click', handlers.onRestartProgram);

  // The left rail starts below the toolbar, whose height changes with wrapping and messages.
  const controls = byId('controls');
  const syncRailTop = () => {
    document.body.style.setProperty('--rail-top', `${controls.getBoundingClientRect().bottom + 8}px`);
  };
  new ResizeObserver(syncRailTop).observe(controls);

  const sourcePanel = byId('source-panel');
  document.addEventListener(SOURCE_EVENT, (event) => {
    const { title, tag, source } = (event as CustomEvent<SourceDetail>).detail;
    byId('source-title').textContent = title;
    byId('source-tag').textContent = tag;
    byId('source-tag').className = `tag tag-${tag}`;
    byId('source-text').textContent = source;
    sourcePanel.classList.add('has-source');
  });

  return {
    setBanner(visible: boolean) {
      byId('invented-banner').hidden = !visible;
      document.body.classList.toggle('has-banner', visible);
      syncRailTop();
    },
    setRecordingInfo(text: string) {
      byId('recording-info').textContent = text;
      byId('recording-info').title = text;
    },
    setErrors(errors: string[]) {
      fillList(byId('errors'), errors);
    },
    setWarnings(warnings: string[]) {
      fillList(byId('warnings'), warnings);
    },
    setControls(state: { hasRecording: boolean; canSwap: boolean; swapLabel: string; replaying: boolean; zoomOpen: boolean }) {
      const swap = byId<HTMLButtonElement>('swap');
      swap.disabled = !state.canSwap;
      swap.textContent = state.swapLabel;
      const replay = byId<HTMLButtonElement>('replay');
      replay.disabled = !state.hasRecording;
      replay.textContent = state.replaying ? 'Stop replay' : 'Replay trips';
      byId('zoom').textContent = state.zoomOpen ? 'Close stop 7 view' : 'Open stop 7 view';
    },
    setProgramState(running: boolean, text: string) {
      byId('program-toggle').textContent = running ? 'Stop' : 'Run';
      byId('program-status').textContent = text;
    },
    setFeedState(text: string) {
      byId('wire-feed').textContent = text;
    },
    setReplayText(text: string | null) {
      const node = byId('replay-status');
      node.hidden = text === null;
      node.textContent = text ?? '';
    },
  };
}
