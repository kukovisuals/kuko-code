// Fetches the Day 560 pass files and compiles them into programs. Nothing here is timed.
import { FULLSCREEN_TRIANGLE_VERTEX } from '../record/fullscreenTriangle';
import { wrapImagePass, wrapVolumePass } from './wrapShadertoy';

export interface PassPrograms {
  volume: WebGLProgram;
  image: WebGLProgram;
  // cost-mid costs the same at every pixel, so any pattern in its timing isn't from a shader.
  control: WebGLProgram;
}

async function fetchPass(name: string): Promise<string> {
  const response = await fetch(`/shaders/${name}.glsl`, { cache: 'no-store' });
  const source = await response.text();
  // A missing file can come back as Vite's HTML fallback with status 200, so check the text too.
  if (!response.ok || source.trimStart().startsWith('<')) {
    throw new Error(`Could not load shaders/${name}.glsl. Run this page with npm run dev.`);
  }
  return source;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string, label: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader returned null');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`${label} did not compile:\n${gl.getShaderInfoLog(shader) ?? 'no info log'}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, fragmentSource: string, label: string): WebGLProgram {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, FULLSCREEN_TRIANGLE_VERTEX, 'Vertex shader'));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource, label));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`${label} did not link:\n${gl.getProgramInfoLog(program) ?? 'no info log'}`);
  }
  return program;
}

export async function loadPasses(gl: WebGL2RenderingContext): Promise<PassPrograms> {
  const names = ['day560-common', 'day560-volume', 'day560-image', 'cost-mid'];
  const [common, volume, image, control] = await Promise.all(names.map(fetchPass));
  return {
    volume: link(gl, wrapVolumePass(common as string, volume as string), 'Volume A'),
    image: link(gl, wrapImagePass(common as string, image as string), 'Image'),
    control: link(gl, control as string, 'cost-mid'),
  };
}
