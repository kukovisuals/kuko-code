// Fetches local shaders and builds programs for the probe. Nothing here is timed.
import { FULLSCREEN_TRIANGLE_VERTEX } from '../record/fullscreenTriangle';

export interface FetchedShader {
  name: string;
  source: string;
  cacheControl: string | null;
  // A missing file can come back as Vite's HTML fallback with status 200, so check the text itself.
  isRawGlsl: boolean;
}

export async function fetchShader(name: string): Promise<FetchedShader> {
  const response = await fetch(`/shaders/${name}.glsl`, { cache: 'no-store' });
  const source = await response.text();
  return {
    name,
    source,
    cacheControl: response.headers.get('cache-control'),
    isRawGlsl: response.ok && source.startsWith('#version 300 es'),
  };
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader returned null');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'Compile failed with no info log');
  }
  return shader;
}

export function buildProgram(gl: WebGL2RenderingContext, fragmentSource: string): WebGLProgram {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, FULLSCREEN_TRIANGLE_VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'Link failed with no info log');
  }
  return program;
}
