// Draws a one-pass Shadertoy-style shader with raw WebGL2: set the inputs, then one draw call.

export interface FrameInputs {
  time: number;
  frame: number;
  mouse: readonly [number, number, number, number];
}

export class ImageRenderer {
  private resolution: WebGLUniformLocation | null;
  private time: WebGLUniformLocation | null;
  private frame: WebGLUniformLocation | null;
  private mouse: WebGLUniformLocation | null;

  constructor(
    private gl: WebGL2RenderingContext,
    program: WebGLProgram,
    private width: number,
    private height: number,
  ) {
    // Looked up once, so a frame's call time is only the calls a frame really needs.
    this.resolution = gl.getUniformLocation(program, 'iResolution');
    this.time = gl.getUniformLocation(program, 'iTime');
    this.frame = gl.getUniformLocation(program, 'iFrame');
    this.mouse = gl.getUniformLocation(program, 'iMouse');
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(program);
    gl.viewport(0, 0, width, height);
  }

  // One frame: 4 uniform calls and 1 draw call. The GPU then runs the shader once per pixel.
  draw(inputs: FrameInputs): void {
    const { gl } = this;
    gl.uniform3f(this.resolution, this.width, this.height, 1);
    gl.uniform1f(this.time, inputs.time);
    gl.uniform1i(this.frame, inputs.frame);
    gl.uniform4f(this.mouse, ...inputs.mouse);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
