// Draws the counting copy into integer textures and reads every pixel's counts back with readPixels.
// Several blocks share one pass (4 per draw buffer). The counting copy is never timed.
import type { Block } from './findBlocks';
import { COUNTERS_PER_OUTPUT, countingShader, type SourceFile } from './countingShader';
import { GlProgram } from './glProgram';

export interface CountRun {
  // Per block id: one count per pixel, rows from the bottom.
  perPixel: Map<string, Uint32Array>;
  passes: number;
  outputsPerPass: number;
}

function integerTarget(gl: WebGL2RenderingContext, width: number, height: number): WebGLTexture {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32UI, width, height);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return texture;
}

function runPass(gl: WebGL2RenderingContext, files: SourceFile[], blocks: Block[], outputs: number, time: number, width: number, height: number, into: Map<string, Uint32Array>): void {
  const program = new GlProgram(gl, countingShader(files, blocks, outputs));
  const used = Math.ceil(blocks.length / COUNTERS_PER_OUTPUT);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  const textures = Array.from({ length: used }, (_, output) => {
    const texture = integerTarget(gl, width, height);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + output, gl.TEXTURE_2D, texture, 0);
    return texture;
  });
  gl.drawBuffers(textures.map((_, output) => gl.COLOR_ATTACHMENT0 + output));
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`The counting framebuffer is incomplete (status 0x${status.toString(16)}).`);
  textures.forEach((_, output) => gl.clearBufferuiv(gl.COLOR, output, [0, 0, 0, 0]));
  gl.viewport(0, 0, width, height);
  program.draw(time, width, height);

  const pixels = new Uint32Array(width * height * COUNTERS_PER_OUTPUT);
  textures.forEach((_, output) => {
    gl.readBuffer(gl.COLOR_ATTACHMENT0 + output);
    gl.readPixels(0, 0, width, height, gl.RGBA_INTEGER, gl.UNSIGNED_INT, pixels);
    for (let channel = 0; channel < COUNTERS_PER_OUTPUT; channel += 1) {
      const block = blocks[output * COUNTERS_PER_OUTPUT + channel];
      if (!block) continue;
      const counts = new Uint32Array(width * height);
      for (let pixel = 0; pixel < counts.length; pixel += 1) counts[pixel] = pixels[pixel * COUNTERS_PER_OUTPUT + channel] as number;
      into.set(block.id, counts);
    }
  });

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  textures.forEach((texture) => gl.deleteTexture(texture));
  gl.deleteFramebuffer(framebuffer);
  program.dispose();
}

export function countBlocks(gl: WebGL2RenderingContext, files: SourceFile[], blocks: Block[], time: number, width: number, height: number): CountRun {
  const outputs = Math.min(Number(gl.getParameter(gl.MAX_DRAW_BUFFERS)), Number(gl.getParameter(gl.MAX_COLOR_ATTACHMENTS)));
  const perPass = outputs * COUNTERS_PER_OUTPUT;
  const perPixel = new Map<string, Uint32Array>();
  let passes = 0;
  for (let start = 0; start < blocks.length; start += perPass) {
    runPass(gl, files, blocks.slice(start, start + perPass), outputs, time, width, height, perPixel);
    passes += 1;
  }
  return { perPixel, passes, outputsPerPass: outputs };
}
