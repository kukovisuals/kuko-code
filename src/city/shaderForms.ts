// Pure: the form the shader is in at each stop. The same program changes shape five times on the way.
// "published" here means documented by the project that does the step, not observed by this page.
import type { ProgramEvent } from '../shared/liveEvents';
import { textSize } from '../shared/translatedText';

export type TranslatedEvent = Extract<ProgramEvent, { type: 'translated' }>;
export interface ShaderForm {
  form: string;
  tag: 'measured' | 'published' | 'modeled';
  source: string;
}

const CHROMIUM = 'Chromium GPU architecture docs: WebGL calls are serialized into a command buffer and run in the GPU process. Not observed by this page';
const ANGLE = "ANGLE's Metal backend docs: GLSL ES is translated to Metal Shading Language source. Not observed by this page";
const NO_API = 'Inferred. No browser API can read anything after the Metal source';

export const SHADER_FORMS: Record<number, ShaderForm> = {
  1: { form: 'text file, as bytes in an HTTP response', tag: 'measured', source: 'fetch() returned these bytes, and PerformanceResourceTiming timed them' },
  2: { form: 'JavaScript string', tag: 'measured', source: 'The string this page passes to gl.shaderSource(), whose SHA-256 is in the recording' },
  3: { form: 'GLSL text, copied into the GPU process', tag: 'published', source: CHROMIUM },
  4: { form: 'GLSL in, Metal source out', tag: 'published', source: ANGLE },
  5: { form: 'Metal source in, machine code for the GPU out', tag: 'modeled', source: NO_API },
  6: { form: 'machine code running, pixels out', tag: 'modeled', source: NO_API },
  7: { form: 'the same machine code, one instruction for 32 pixels', tag: 'modeled', source: NO_API },
  8: { form: 'pixels: a finished image', tag: 'modeled', source: NO_API },
};

// Stop 4 becomes measured once the program frame has sent the text Chrome really returned for this shader.
// Every other stop, and stop 4 without that text, keeps its fixed form.
export function shaderFormAt(stop: number, translated: TranslatedEvent | null): ShaderForm | undefined {
  const fixed = SHADER_FORMS[stop];
  if (stop !== 4 || !translated || translated.text === null) return fixed;
  const out = textSize(translated.text);
  const language = translated.language === 'Metal Shading Language' ? 'Metal source' : (translated.language ?? 'unknown text');
  return {
    form: `GLSL in, ${language} out`,
    tag: 'measured',
    source: `WEBGL_debug_shaders.getTranslatedShaderSource returned ${out.bytes.toLocaleString('en-US')} bytes (${out.lines} lines) of ${translated.language} for this exact fragment shader, in this Chrome. The program frame read it. The city only shows it`,
  };
}
