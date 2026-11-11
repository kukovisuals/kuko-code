// Pure: the form the shader is in at each stop. The same program changes shape five times on the way.
// "published" here means documented by the project that does the step, not observed by this page.
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
