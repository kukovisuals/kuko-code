// Which shader the live program runs. The program page, the experiments page and the city all read this, so their
// text agrees.
export interface LiveProgram {
  name: string;
  // Names the saved experiment file, data/experiments/<slug>.json.
  slug: string;
  // Shadertoy pastes Common in front of Image, so two files make one fragment shader. Null when there is no Common.
  commonFile: string | null;
  imageFile: string;
  width: number;
  height: number;
}

export const LIVE_PROGRAM: LiveProgram = {
  name: 'Day 564',
  slug: 'day564',
  commonFile: null,
  imageFile: 'day564-image',
  width: 1280,
  height: 800,
};

// The files fetched for the live program, in the order they are pasted together: Common first, then Image.
export const LIVE_FILES: string[] = [LIVE_PROGRAM.commonFile, LIVE_PROGRAM.imageFile].filter((name): name is string => name !== null);
