// Builds the counting copy: the user's Common and Image text with "_kN += 1u;" added just inside some blocks,
// and a main() that writes the counts instead of a color. The counters never feed back into the user's code,
// so every if and loop takes the same path as in the real shader. The user's files are never written.
import { SHADERTOY_PRELUDE } from '../shaderView/wrapShadertoy';
import type { Block } from './findBlocks';

// Each output is one RGBA32UI texture: four counters per draw buffer.
export const COUNTERS_PER_OUTPUT = 4;

export interface SourceFile {
  file: string;
  text: string;
}

// Inserts from the end of the file backwards, so earlier indexes stay valid.
export function instrument(text: string, counted: { block: Block; slot: number }[]): string {
  let out = text;
  const byPosition = [...counted].sort((a, b) => b.block.openIndex - a.block.openIndex);
  for (const { block, slot } of byPosition) {
    const at = block.openIndex + 1;
    out = `${out.slice(0, at)} _k${slot} += 1u;${out.slice(at)}`;
  }
  return out;
}

// One pass counts up to outputs x 4 blocks. Slot n lives in output floor(n / 4), channel n % 4.
export function countingShader(files: SourceFile[], blocks: Block[], outputs: number): string {
  if (blocks.length > outputs * COUNTERS_PER_OUTPUT) throw new Error('more blocks than counter slots in one pass');
  const slots = blocks.map((block, slot) => ({ block, slot }));
  const used = Math.ceil(blocks.length / COUNTERS_PER_OUTPUT);
  const declarations = [
    ...Array.from({ length: used }, (_, output) => `layout(location = ${output}) out uvec4 _counts${output};`),
    ...slots.map(({ slot }) => `uint _k${slot} = 0u;`),
  ].join('\n');
  const bodies = files.map(({ file, text }) => instrument(text, slots.filter(({ block }) => block.file === file))).join('\n');
  const writes = Array.from({ length: used }, (_, output) => {
    const channel = (index: number) => {
      const slot = output * COUNTERS_PER_OUTPUT + index;
      return slot < blocks.length ? `_k${slot}` : '0u';
    };
    return `  _counts${output} = uvec4(${channel(0)}, ${channel(1)}, ${channel(2)}, ${channel(3)});`;
  }).join('\n');
  return `${SHADERTOY_PRELUDE}${declarations}
${bodies}

void main() {
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(color, gl_FragCoord.xy);
${writes}
}
`;
}
