// Compiles one fragment shader with the fixed fullscreen triangle, and draws it with Shadertoy's inputs.
// It keeps the fragment shader object, because WEBGL_debug_shaders reads the translated text from it.
import { FULLSCREEN_TRIANGLE_VERTEX } from '../record/fullscreenTriangle';

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader returned null');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'compile failed with no info log');
  }
  return shader;
}

export class GlProgram {
  readonly program: WebGLProgram;
  readonly fragment: WebGLShader;
  private resolution: WebGLUniformLocation | null;
  private time: WebGLUniformLocation | null;
  private frame: WebGLUniformLocation | null;
  private mouse: WebGLUniformLocation | null;

  constructor(
    private gl: WebGL2RenderingContext,
    fragmentSource: string,
  ) {
    const program = gl.createProgram();
    this.fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, FULLSCREEN_TRIANGLE_VERTEX));
    gl.attachShader(program, this.fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? 'link failed with no info log');
    }
    this.program = program;
    this.resolution = gl.getUniformLocation(program, 'iResolution');
    this.time = gl.getUniformLocation(program, 'iTime');
    this.frame = gl.getUniformLocation(program, 'iFrame');
    this.mouse = gl.getUniformLocation(program, 'iMouse');
  }

  // The same inputs the live program sets, then one draw call.
  draw(time: number, width: number, height: number): void {
    const { gl } = this;
    gl.useProgram(this.program);
    gl.uniform3f(this.resolution, width, height, 1);
    gl.uniform1f(this.time, time);
    gl.uniform1i(this.frame, 0);
    gl.uniform4f(this.mouse, 0, 0, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}
