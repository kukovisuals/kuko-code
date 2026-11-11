// Stop 4's compiler view: the GLSL beside the Metal source Chrome returned for it, with the user's functions
// marked in both. The two texts are measured. Everything after the Metal source is drawn as modeled, because
// no browser API can read it. The program frame read these texts; this file only shows them.
import type { TranslatedEvent } from '../shaderForms';
import { callCount, countMatches, defineNames, definitionLine, isAngleOnly, linesNaming, nameCount, textSize, userFunctions, type TextSize } from '../../shared/translatedText';

type StepStatus = 'measured' | 'modeled' | 'missing';

const TRANSLATED_SOURCE = 'WEBGL_debug_shaders.getTranslatedShaderSource on the fragment shader, read by the program frame after the link was timed.';
const GLSL_SOURCE = 'The string the program frame handed to gl.shaderSource(): the wrapper, then Common, then Image.';
const COUNT_SOURCE = 'Counted in the two texts below, comments left out.';
const SIMD_SOURCE = 'community source: metal-benchmarks';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

const tag = (status: StepStatus) => element('span', `tag tag-${status}`, status);
const describeSize = (size: TextSize) => `${size.bytes.toLocaleString('en-US')} bytes, ${size.lines.toLocaleString('en-US')} lines`;

function step(title: string, detail: string, status: StepStatus): HTMLElement {
  const box = element('div', `compiler-step compiler-step-${status}`);
  const head = element('div', 'compiler-step-title', title);
  head.append(' ', tag(status));
  box.append(head, element('p', 'muted', detail));
  return box;
}

function fact(text: string, status: StepStatus, source: string): HTMLElement {
  const row = element('div', 'compiler-fact', text);
  row.title = source;
  row.prepend(tag(status), ' ');
  return row;
}

interface Pane {
  node: HTMLElement;
  listing: HTMLElement;
  mark(lines: number[], className: string): void;
  select(lines: number[], focus: number | null): void;
}

function pane(title: string, text: string, status: StepStatus, source: string, dimAngle: boolean): Pane {
  const node = element('div', 'compiler-pane');
  const head = element('div', 'compiler-pane-head');
  head.append(element('strong', '', title), ' ', tag(status), ' ', element('span', 'muted', describeSize(textSize(text))));
  const listing = element('pre', 'compiler-text');
  text.split('\n').forEach((line, index) => {
    // Lines that are only ANGLE's are dimmed, so the user's code stands out inside the boilerplate.
    const row = element('div', dimAngle && isAngleOnly(line) ? 'code-line code-angle' : 'code-line');
    row.dataset.line = String(index + 1);
    row.append(element('span', 'code-gutter', String(index + 1)), element('span', '', line || ' '));
    listing.append(row);
  });
  node.append(head, listing, element('p', 'muted compiler-pane-source', source));
  const rowAt = (line: number) => listing.querySelector<HTMLElement>(`.code-line[data-line="${line}"]`);
  return {
    node,
    listing,
    mark(lines, className) {
      lines.forEach((line) => rowAt(line)?.classList.add(className));
    },
    select(lines, focus) {
      listing.querySelectorAll('.code-selected').forEach((row) => row.classList.remove('code-selected'));
      lines.forEach((line) => rowAt(line)?.classList.add('code-selected'));
      const target = focus === null ? null : rowAt(focus);
      if (target) listing.scrollTo({ top: target.offsetTop - listing.clientHeight / 3, behavior: 'smooth' });
    },
  };
}

function steps(glsl: string, translated: TranslatedEvent): HTMLElement {
  const strip = element('div', 'compiler-steps');
  const text = translated.text;
  strip.append(
    step('1. Your GLSL', `${describeSize(textSize(glsl))}, handed to WebGL.`, 'measured'),
    step(
      "2. ANGLE, in Chrome's GPU process",
      text === null
        ? 'WEBGL_debug_shaders is not exposed, so the text it makes cannot be read here.'
        : `Compiler 1 of 2. Returned ${translated.language}: ${describeSize(textSize(text))}.`,
      text === null ? 'missing' : 'measured',
    ),
    step(
      "3. Apple's Metal compiler",
      'Compiler 2 of 2, part of macOS. Turns the Metal source into GPU code, and may unroll a loop with a constant bound, like the AA loop. A page cannot read its output or its choices; its time is inside the link.',
      'modeled',
    ),
    step('4. GPU machine code', `Runs on the GPU cores, one instruction for 32 pixels at once (${SIMD_SOURCE}). A page cannot read it.`, 'modeled'),
  );
  return strip;
}

// What changed between the two texts, counted in them. These are the ticket's two teaching points.
function facts(glsl: string, text: string): HTMLElement {
  const box = element('div', 'compiler-facts');
  const forIn = countMatches(glsl, /\bfor\s*\(/);
  const whileIn = countMatches(glsl, /\bwhile\s*\(/);
  const forOut = countMatches(text, /\bfor\s*\(/);
  const whileOut = countMatches(text, /\bwhile\s*\(/);
  box.append(fact(`Loops: GLSL has ${forIn} for and ${whileIn} while. Metal has ${forOut} for and ${whileOut} while. Same work, rewritten by ANGLE.`, 'measured', COUNT_SOURCE));
  for (const name of defineNames(glsl)) {
    box.append(
      fact(
        `#define ${name}: the name is written ${nameCount(glsl, name)} times in GLSL and ${nameCount(text, name)} in Metal. The preprocessor swapped in its value before ANGLE translated anything.`,
        'measured',
        COUNT_SOURCE,
      ),
    );
  }
  const lines = text.split('\n');
  const angleLines = lines.filter((line) => line.includes('ANGLE')).length;
  const angleOnly = lines.filter(isAngleOnly).length;
  box.append(
    fact(
      `${angleLines} of the ${lines.length} Metal lines name ANGLE. ${angleOnly} of them name none of your functions or variables; those are dimmed below.`,
      'measured',
      COUNT_SOURCE,
    ),
  );
  return box;
}

export interface CompilerPanel {
  open(translated: TranslatedEvent): void;
  close(): void;
}

export function createCompilerPanel(): CompilerPanel {
  const panel = element('section', 'panel', '');
  panel.id = 'compiler-panel';
  panel.setAttribute('aria-label', 'Compiler view');
  panel.hidden = true;
  document.body.append(panel);

  const close = () => {
    panel.hidden = true;
  };
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) close();
  });

  return {
    close,
    open(translated) {
      const { glsl, text } = translated;
      const head = element('header', 'compiler-head');
      const shut = element('button', '', 'Close');
      shut.addEventListener('click', close);
      const time = new Date(translated.at).toLocaleTimeString('en-US');
      head.append(element('strong', '', 'Stop 4: what the compilers turned the shader into'), element('span', 'muted', ` read at ${time}`), shut);
      panel.replaceChildren(head, steps(glsl, translated));
      panel.hidden = false;
      if (text === null) return;

      const left = pane('Your GLSL', glsl, 'measured', GLSL_SOURCE, false);
      const right = pane(`What ANGLE returned: ${translated.language}`, text, 'measured', TRANSLATED_SOURCE, true);
      const list = element('div', 'compiler-functions');
      list.append(element('span', 'muted', 'Your functions, marked in both texts. Click one: '));
      for (const fn of userFunctions(glsl)) {
        const outLine = definitionLine(text, fn.name);
        const calls = callCount(glsl, fn.name);
        left.mark([fn.line], 'code-def');
        if (outLine !== null) right.mark([outLine], 'code-def');
        const button = element('button', 'compiler-function');
        button.type = 'button';
        const missing = calls === 0 ? 'never called, so ANGLE left it out' : 'not found by name';
        button.title =
          outLine !== null
            ? `GLSL line ${fn.line}, Metal line ${outLine} as _u${fn.name}.`
            : calls === 0
              ? 'Defined in the GLSL but never called (comments aside), and absent from the Metal text.'
              : 'Called in the GLSL but not found by name in the Metal text: renamed or inlined.';
        button.append(element('code', '', fn.name), element('span', 'muted', ` ${fn.line} -> ${outLine ?? missing}`));
        button.addEventListener('click', () => {
          left.select(linesNaming(glsl, fn.name), fn.line);
          right.select(linesNaming(text, fn.name), outLine);
        });
        list.append(button);
      }
      const texts = element('div', 'compiler-texts');
      texts.append(left.node, right.node);
      panel.append(facts(glsl, text), list, texts);
    },
  };
}
