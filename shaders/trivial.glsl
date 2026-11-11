#version 300 es
// A solid color: the cheapest possible fragment shader. Later runs use it as the baseline for
// link and first draw. GLSL requires #version on the very first line, so comments go after it.
precision highp float;

out vec4 fragColor;

void main() {
  fragColor = vec4(0.13, 0.45, 0.76, 1.0);
}
