// Pure: did building the shader raise the GPU process's CPU reading? Compares the samples from before
// the build with the ones that overlap it, and says so plainly when the answer is no or unknown.
export interface LoadSample {
  from: number;
  to: number;
  percent: number;
}

export interface CompileEffect {
  verdict: 'rose' | 'no-rise' | 'unknown';
  text: string;
}

// Our own threshold, in percentage points. Smaller changes are within the sample-to-sample noise.
export const RISE_POINTS = 5;
const BEFORE_SAMPLES = 4;

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] as number;

export function compileEffect(samples: LoadSample[], build: { from: number; to: number }): CompileEffect {
  const before = samples.filter((sample) => sample.to <= build.from).slice(-BEFORE_SAMPLES);
  const during = samples.filter((sample) => sample.from < build.to && sample.to > build.from);
  const buildMs = Math.round(build.to - build.from);
  if (during.length === 0) {
    return { verdict: 'unknown', text: 'Build vs GPU process CPU: waiting for a sample that covers the build' };
  }
  const peak = Math.round(Math.max(...during.map((sample) => sample.percent)));
  if (before.length === 0) {
    return { verdict: 'unknown', text: `Build vs GPU process CPU: ${peak}% during, but no sample from before the build. Restart the program to compare` };
  }
  const base = Math.round(median(before.map((sample) => sample.percent)));
  const sampleMs = Math.round(median(during.map((sample) => sample.to - sample.from)));
  return peak - base >= RISE_POINTS
    ? { verdict: 'rose', text: `The build raised GPU process CPU: ${base}% before, ${peak}% during` }
    : { verdict: 'no-rise', text: `The build did not visibly raise GPU process CPU: ${base}% before, ${peak}% during. The build took ${buildMs} ms inside a ${sampleMs} ms sample` };
}
