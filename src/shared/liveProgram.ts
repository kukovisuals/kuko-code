// Which shader the live program runs. The program page and the city both read this, so their text agrees.
export const LIVE_PROGRAM = {
  name: 'Day 442',
  // Shadertoy pastes Common in front of Image, so two files make one fragment shader.
  commonFile: 'day442-common',
  imageFile: 'day442-image',
  width: 1280,
  height: 800,
} as const;
