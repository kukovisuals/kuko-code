// The fixed vertex shader every run uses. It lives here, not in ./shaders, because only the
// fragment shader is under test. One triangle larger than the screen covers every pixel with no
// attributes or buffers: draw it with gl.drawArrays(gl.TRIANGLES, 0, 3).
export const FULLSCREEN_TRIANGLE_VERTEX = `#version 300 es
void main() {
  vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;
