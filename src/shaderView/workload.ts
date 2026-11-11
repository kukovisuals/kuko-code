// Modeled workload: counts worked out from the shader's code, with no measurement behind them.
// Every formula mirrors a line in shaders/day560-volume.glsl or shaders/day560-image.glsl.

export type Mouse = readonly [number, number, number, number];
type Vec3 = [number, number, number];

const STEP = 1 / 100;

// Mirrors `v *= rot(a)` for mat2(cos(a + vec4(0,11,33,0))), which multiplies as a row vector.
function rotate(u: number, v: number, angle: number): [number, number] {
  const m00 = Math.cos(angle);
  const m01 = Math.cos(angle + 11);
  const m10 = Math.cos(angle + 33);
  const m11 = Math.cos(angle);
  return [u * m00 + v * m01, u * m10 + v * m11];
}

// How many march steps the Image pass takes at one pixel. `T` is never changed in the loop, so
// `T > .01` never ends it early, and the count depends only on the ray's path through the cube.
export function marchSteps(x: number, y: number, width: number, height: number, mouse: Mouse): number {
  const pressed = Math.hypot(mouse[0], mouse[1]) > 10;
  const mouseX = pressed ? mouse[0] / width - 0.5 : 0;
  const mouseY = pressed ? mouse[1] / height - 0.5 : 0;

  const rawD: Vec3 = [2 * x - width, 2 * y - height, -2 * height - 1];
  const length = Math.hypot(...rawD);
  const direction: Vec3 = [rawD[0] / length, rawD[1] / length, rawD[2] / length];
  const origin: Vec3 = [0, 0, 1];

  [origin[1], origin[2]] = rotate(origin[1], origin[2], 3 * mouseY);
  [direction[1], direction[2]] = rotate(direction[1], direction[2], 3 * mouseY);
  [origin[0], origin[2]] = rotate(origin[0], origin[2], 3 * mouseX);
  [direction[0], direction[2]] = rotate(direction[0], direction[2], 3 * mouseX);

  let near = 0;
  let far = Infinity;
  for (let axis = 0; axis < 3; axis++) {
    const t0 = (-1 - (origin[axis] as number)) / (direction[axis] as number);
    const t1 = (1 - (origin[axis] as number)) / (direction[axis] as number);
    near = Math.max(near, Math.min(t0, t1));
    far = Math.min(far, Math.max(t0, t1));
  }
  return far > near ? Math.ceil((far - near) / STEP) : 0;
}

export interface GridSize {
  columns: number;
  rows: number;
}

// Average march steps per pixel for each grid cell, bottom row first, to match gl.scissor.
export function stepsPerCell(width: number, height: number, grid: GridSize, mouse: Mouse, sampleEvery = 8): number[] {
  const cells: number[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      const startX = Math.floor((column * width) / grid.columns);
      const endX = Math.floor(((column + 1) * width) / grid.columns);
      const startY = Math.floor((row * height) / grid.rows);
      const endY = Math.floor(((row + 1) * height) / grid.rows);
      let total = 0;
      let samples = 0;
      for (let y = startY + sampleEvery / 2; y < endY; y += sampleEvery) {
        for (let x = startX + sampleEvery / 2; x < endX; x += sampleEvery) {
          total += marchSteps(x, y, width, height, mouse);
          samples += 1;
        }
      }
      cells.push(samples > 0 ? total / samples : 0);
    }
  }
  return cells;
}

export interface VolumeWorkload {
  voxels: number;
  activeVoxels: number;
  texelFetches: number;
  renderTargets: number;
}

// The pass returns early outside max(|q.x|, |q.y|) <= .92 and |q.z| <= .95, where q = p/64 - 1.
// Each voxel that continues reads itself once and its 6 neighbors once.
export function volumeWorkload(size: number): VolumeWorkload {
  let activeXY = 0;
  let activeZ = 0;
  for (let i = 0; i < size; i++) {
    const q = Math.abs((i + 0.5) / (size / 2) - 1);
    if (q <= 0.92) activeXY += 1;
    if (q <= 0.95) activeZ += 1;
  }
  const activeVoxels = activeXY * activeXY * activeZ;
  return { voxels: size ** 3, activeVoxels, texelFetches: activeVoxels * 7, renderTargets: size };
}
