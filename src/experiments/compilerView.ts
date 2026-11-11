// The compiler panel: the steps from GLSL to the GPU, which of them a page can read, and the translated text
// Chrome returned, with the user's functions found in it.
import type { Translated } from './translatedSource';
import { linesNaming } from './translatedSource';

export interface UserFunction {
  name: string;
  file: string;
  line: number;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function chip(status: 'measured' | 'modeled' | 'missing'): HTMLElement {
  return element('span', `status status-${status}`, status);
}

function step(title: string, detail: string, status: 'measured' | 'modeled' | 'missing'): HTMLElement {
  const box = element('div', `step step-${status}`);
  const heading = element('div', 'step-title', title);
  heading.append(' ', chip(status));
  box.append(heading, element('p', 'muted', detail));
  return box;
}

const size = (text: string) => `${new TextEncoder().encode(text).length.toLocaleString('en-US')} bytes, ${text.split('\n').length.toLocaleString('en-US')} lines`;

export function renderCompiler(container: HTMLElement, glsl: string, translated: Translated | null, functions: UserFunction[]): void {
  container.replaceChildren();
  const steps = element('div', 'steps');
  steps.append(
    step('1. Your GLSL', `Wrapper + Common + Image, as handed to WebGL: ${size(glsl)}.`, 'measured'),
    step(
      '2. ANGLE translator, in Chrome',
      translated ? `Returned ${translated.language}: ${size(translated.text)}. Shown below as Chrome returned it.` : 'WEBGL_debug_shaders is not exposed, so this text cannot be read here.',
      translated ? 'measured' : 'missing',
    ),
    step("3. Apple's Metal compiler", 'Turns the text into Apple GPU code. A page cannot read its output, its time apart from the link, or its choices.', 'modeled'),
    step('4. GPU machine code', 'Runs on the GPU cores, 32 pixels per SIMD group (community source: metal-benchmarks). A page cannot read it.', 'modeled'),
  );
  container.append(steps);
  if (!translated) return;

  const listing = element('pre', 'translated');
  const lines = translated.text.split('\n');
  lines.forEach((line, index) => {
    const row = element('div', 'translated-line');
    row.dataset.line = String(index + 1);
    row.append(element('span', 'gutter', String(index + 1)), element('span', '', line || ' '));
    listing.append(row);
  });

  const table = element('div', 'functions');
  table.append(element('p', 'muted', 'Your functions, found by name in the translated text. Click one to jump to it.'));
  for (const fn of functions) {
    const found = linesNaming(translated.text, fn.name);
    const button = element('button', 'function-row');
    button.type = 'button';
    button.append(element('code', '', fn.name), element('span', 'muted', ` ${fn.file} line ${fn.line} -> `), element('span', '', found.length > 0 ? `translated lines ${found.join(', ')}` : 'not found by name (renamed, inlined or removed)'));
    button.disabled = found.length === 0;
    button.addEventListener('click', () => {
      listing.querySelectorAll('.translated-line.selected').forEach((node) => node.classList.remove('selected'));
      for (const line of found) listing.querySelector(`.translated-line[data-line="${line}"]`)?.classList.add('selected');
      const target = listing.querySelector<HTMLElement>(`.translated-line[data-line="${found[0]}"]`);
      if (target) listing.scrollTo({ top: target.offsetTop - 40, behavior: 'smooth' });
    });
    table.append(button);
  }
  container.append(table, listing);
}
