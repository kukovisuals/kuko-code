// Draws the shader's two passes with raw WebGL2. Volume A writes the next 128-cube state from the
// previous one, slice by slice. Image then ray-marches through the newest state.
import type { PassPrograms } from './loadPasses';

// Not stated in the export: the shader's own code implies it (p/64 - 1, and *128 in density()).
export const VOLUME_SIZE = 128;
export const BUFFER = { width: 1280, height: 800 } as const;

export interface FrameInputs {
  time: number;
  frame: number;
  mouse: readonly [number, number, number, number];
}

function createVolumeTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, texture);
  // The export asks for 8-bit, linear and clamped. WebGL starts texture storage at zero.
  gl.texStorage3D(gl.TEXTURE_3D, 1, gl.RGBA8, VOLUME_SIZE, VOLUME_SIZE, VOLUME_SIZE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  return texture;
}

export class DayRenderer {
  private current: WebGLTexture;
  private next: WebGLTexture;
  private framebuffer: WebGLFramebuffer;
  private volumeSlice: WebGLUniformLocation | null;

  constructor(
    private gl: WebGL2RenderingContext,
    private programs: Pick<PassPrograms, 'volume' | 'image'> & Partial<Pick<PassPrograms, 'control'>>,
  ) {
    this.current = createVolumeTexture(gl);
    this.next = createVolumeTexture(gl);
    this.framebuffer = gl.createFramebuffer();
    this.volumeSlice = gl.getUniformLocation(programs.volume, 'uSlice');
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  private setInputs(program: WebGLProgram, width: number, height: number, inputs: FrameInputs): void {
    const { gl } = this;
    gl.useProgram(program);
    gl.uniform3f(gl.getUniformLocation(program, 'iResolution'), width, height, 1);
    gl.uniform1f(gl.getUniformLocation(program, 'iTime'), inputs.time);
    gl.uniform1i(gl.getUniformLocation(program, 'iFrame'), inputs.frame);
    gl.uniform4f(gl.getUniformLocation(program, 'iMouse'), ...inputs.mouse);
    gl.uniform1i(gl.getUniformLocation(program, 'iChannel0'), 0);
  }

  // Each slice is a separate draw into a separate render target.
  drawVolume(inputs: FrameInputs): void {
    const { gl } = this;
    this.setInputs(this.programs.volume, VOLUME_SIZE, VOLUME_SIZE, inputs);
    gl.bindTexture(gl.TEXTURE_3D, this.current);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, VOLUME_SIZE, VOLUME_SIZE);
    for (let slice = 0; slice < VOLUME_SIZE; slice++) {
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.next, 0, slice);
      gl.uniform1f(this.volumeSlice, slice);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, null, 0, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    [this.current, this.next] = [this.next, this.current];
  }

  // Binds the state the Image pass reads. The scissor can then limit a draw to one region.
  prepareImage(inputs: FrameInputs): void {
    const { gl } = this;
    this.setInputs(this.programs.image, BUFFER.width, BUFFER.height, inputs);
    gl.bindTexture(gl.TEXTURE_3D, this.current);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, BUFFER.width, BUFFER.height);
  }

  prepareControl(inputs: FrameInputs): void {
    const { gl } = this;
    const { control } = this.programs;
    if (!control) throw new Error('This renderer was built without the control program');
    gl.useProgram(control);
    gl.uniform1f(gl.getUniformLocation(control, 'u_time'), inputs.time);
    gl.uniform2f(gl.getUniformLocation(control, 'u_resolution'), BUFFER.width, BUFFER.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, BUFFER.width, BUFFER.height);
  }

  drawImage(): void {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  }
}
