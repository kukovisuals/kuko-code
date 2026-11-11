// Turns Shadertoy-style pass code into complete WebGL2 fragment shaders.
// The wrapper is ours, not Shadertoy's, and it is part of what gets compiled (backlog D3).

// Everything in front of the user's code except the output. The experiments page's counting copy reuses it.
export const SHADERTOY_PRELUDE = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouse;
uniform sampler3D iChannel0;
uniform float uSlice;
`;

const HEADER = `${SHADERTOY_PRELUDE}out vec4 outColor;
`;

const IMAGE_MAIN = `
void main() {
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(color, gl_FragCoord.xy);
  outColor = vec4(color.rgb, 1.0);
}
`;

// A fragment shader draws one 2D layer at a time, so uSlice supplies the third voxel coordinate.
const VOLUME_MAIN = `
void main() {
  vec4 color = vec4(0.0);
  mainVolume(color, vec3(gl_FragCoord.xy, uSlice + 0.5));
  outColor = color;
}
`;

export function wrapImagePass(common: string, image: string): string {
  return `${HEADER}${common}\n${image}\n${IMAGE_MAIN}`;
}

export function wrapVolumePass(common: string, volume: string): string {
  return `${HEADER}${common}\n${volume}\n${VOLUME_MAIN}`;
}
