#version 300 es
// Cost ladder: cost-low, cost-mid and cost-high differ only in ITERATIONS, so cost changes on purpose.
precision highp float;

#define ITERATIONS 32

uniform float u_time;
uniform vec2 u_resolution;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  // u_time is only known at run time, so the compiler can't work out the loop ahead of time.
  float value = fract(uv.x + uv.y + u_time);
  for (int i = 0; i < ITERATIONS; i++) {
    value = fract(sin(value * 12.9898 + float(i) * 0.1 + u_time) * 43758.5453);
  }
  // The result reaches the output, so the compiler can't delete the loop as unused.
  fragColor = vec4(vec3(value), 1.0);
}
