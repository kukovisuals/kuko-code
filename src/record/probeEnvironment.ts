// Asks WebGL2 what this browser really exposes. It returns only the schema's environment fields,
// so no device identifier can leave through here.
import type { Environment } from '../shared/types';

// TypeScript's DOM types don't include this extension, so its shape is declared here.
export interface TimerQueryExt {
  readonly QUERY_COUNTER_BITS_EXT: number;
  readonly TIME_ELAPSED_EXT: number;
  readonly TIMESTAMP_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
}

export function getTimerQueryExt(gl: WebGL2RenderingContext): TimerQueryExt | null {
  return gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerQueryExt | null;
}

function readBrowserMajor(): number {
  const match = /Chrome\/(\d+)/.exec(navigator.userAgent);
  return match ? Number(match[1]) : 0;
}

// Plain gl.RENDERER can be masked, so prefer the debug extension's unmasked value.
function readRenderer(gl: WebGL2RenderingContext): string {
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const name = gl.getParameter(debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  return String(name);
}

// gl.getQuery returns a number for this pname, although its type says WebGLQuery.
function readCounterBits(gl: WebGL2RenderingContext, target: number, ext: TimerQueryExt): number {
  return Number(gl.getQuery(target, ext.QUERY_COUNTER_BITS_EXT));
}

export function probeEnvironment(gl: WebGL2RenderingContext): Environment {
  const timer = getTimerQueryExt(gl);
  return {
    browserMajor: readBrowserMajor(),
    glRenderer: readRenderer(gl),
    timerQueryExposed: timer !== null,
    parallelCompileExposed: gl.getExtension('KHR_parallel_shader_compile') !== null,
    timeElapsedBits: timer ? readCounterBits(gl, timer.TIME_ELAPSED_EXT, timer) : 0,
    timestampBits: timer ? readCounterBits(gl, timer.TIMESTAMP_EXT, timer) : 0,
  };
}
