// The recorder page. Raw browser APIs only, no Three.js and nothing animating, so it measures the
// shader and not itself. T09 builds stop 1; later tickets add a section per stop.
import { listShaderFiles, measureFetch } from './fetchShader';
import { metricView } from './metricView';

const FETCH_REPEATS = 20;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`record.html is missing #${id}`);
  return element as T;
}

const picker = byId<HTMLSelectElement>('shader');
const runButton = byId<HTMLButtonElement>('run');
const output = byId<HTMLDivElement>('stop-1');

// performance.now() is coarser without cross-origin isolation, so show whether the headers took effect.
byId('isolation').textContent = `crossOriginIsolated: ${self.crossOriginIsolated}`;

for (const file of listShaderFiles()) {
  picker.append(new Option(file, file));
}

function show(...elements: (HTMLElement | string)[]): void {
  output.replaceChildren(...elements);
}

function paragraph(text: string): HTMLParagraphElement {
  const element = document.createElement('p');
  element.textContent = text;
  return element;
}

async function runStop1(): Promise<void> {
  runButton.disabled = true;
  show(paragraph(`Fetching ${picker.value} ${FETCH_REPEATS} times...`));
  try {
    const result = await measureFetch(picker.value, FETCH_REPEATS);
    const kind = result.plainFragmentShader
      ? 'Plain #version 300 es fragment shader: the later stops can record it.'
      : 'Not a plain #version 300 es fragment shader (a Shadertoy-style pass). Stop 1 can time it, ' +
        'but stops 2 to 8 take plain fragment shaders only for now (D3 in docs/backlog.md).';
    show(
      metricView(result.metric),
      paragraph(`bytes: ${result.shader.bytes} (measured: length of the response body)`),
      paragraph(`sha256: ${result.shader.sha256} (measured: crypto.subtle over the response body)`),
      paragraph(kind),
    );
  } catch (error) {
    show(paragraph(`Stop 1 failed: ${error instanceof Error ? error.message : String(error)}`));
  } finally {
    runButton.disabled = false;
  }
}

runButton.addEventListener('click', () => void runStop1());
