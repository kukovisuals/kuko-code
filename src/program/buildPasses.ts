// The build trip for real: fetches the GLSL, then compiles and links it, reporting each step as it ends.
import { FULLSCREEN_TRIANGLE_VERTEX } from '../record/fullscreenTriangle';
import type { ProgramEvent } from '../shared/liveEvents';
import { LIVE_PROGRAM } from '../shared/liveProgram';
import { translatedSource } from '../shared/translatedSource';
import { wrapImagePass } from '../shaderView/wrapShadertoy';

type Report = (event: ProgramEvent) => void;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// One at a time, so adding the durations up gives the real time spent fetching.
async function fetchSource(name: string, report: Report): Promise<string> {
  const url = new URL(`/shaders/${name}.glsl`, location.href).href;
  const startedAt = performance.now();
  const response = await fetch(url, { cache: 'no-store' });
  const source = await response.text();
  // A missing file can come back as Vite's HTML fallback with status 200, so check the text too.
  if (!response.ok || source.trimStart().startsWith('<')) {
    throw new Error(`Could not load shaders/${name}.glsl. Run this page with npm run dev.`);
  }
  const fallbackMs = performance.now() - startedAt;
  const entry = performance.getEntriesByName(url).at(-1) as PerformanceResourceTiming | undefined;
  report({
    type: 'fetch',
    at: Date.now(),
    file: `shaders/${name}.glsl`,
    ms: entry?.duration ?? fallbackMs,
    bytes: new TextEncoder().encode(source).length,
  });
  return source;
}

function compileStage(gl: WebGL2RenderingContext, type: number, source: string, label: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader returned null');
  const startedAt = performance.now();
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const callsMs = performance.now() - startedAt;
  // Asking for the status makes this thread wait for the GPU process to finish compiling.
  const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS) as boolean;
  const compileMs = performance.now() - startedAt;
  if (!ok) throw new Error(`${label} did not compile:\n${gl.getShaderInfoLog(shader) ?? 'no info log'}`);
  return { shader, callsMs, compileMs };
}

function buildProgram(gl: WebGL2RenderingContext, fragmentSource: string, report: Report): WebGLProgram {
  const vertex = compileStage(gl, gl.VERTEX_SHADER, FULLSCREEN_TRIANGLE_VERTEX, 'Vertex shader');
  const fragment = compileStage(gl, gl.FRAGMENT_SHADER, fragmentSource, LIVE_PROGRAM.name);
  report({
    type: 'compile',
    at: Date.now(),
    callsMs: vertex.callsMs + fragment.callsMs,
    compileMs: vertex.compileMs + fragment.compileMs,
  });

  const program = gl.createProgram();
  const startedAt = performance.now();
  gl.attachShader(program, vertex.shader);
  gl.attachShader(program, fragment.shader);
  gl.linkProgram(program);
  const callsMs = performance.now() - startedAt;
  const ok = gl.getProgramParameter(program, gl.LINK_STATUS) as boolean;
  const linkMs = performance.now() - startedAt;
  if (!ok) throw new Error(`${LIVE_PROGRAM.name} did not link:\n${gl.getProgramInfoLog(program) ?? 'no info log'}`);
  report({ type: 'link', at: Date.now(), callsMs, linkMs });
  // Read only after the link is timed, so asking for the text can't land inside any measured time.
  const translated = translatedSource(gl, fragment.shader);
  report({ type: 'translated', at: Date.now(), glsl: fragmentSource, text: translated?.text ?? null, language: translated?.language ?? null });
  return program;
}

export async function buildLiveProgram(gl: WebGL2RenderingContext, report: Report): Promise<WebGLProgram> {
  const common = LIVE_PROGRAM.commonFile === null ? null : await fetchSource(LIVE_PROGRAM.commonFile, report);
  const image = await fetchSource(LIVE_PROGRAM.imageFile, report);
  // With no Common pass, the source is the Image file alone, so its bytes and hash match the file on disk.
  const whole = common === null ? image : `${common}\n${image}`;
  report({ type: 'source', at: Date.now(), bytes: new TextEncoder().encode(whole).length, sha256: await sha256Hex(whole) });
  return buildProgram(gl, wrapImagePass(common ?? '', image), report);
}
