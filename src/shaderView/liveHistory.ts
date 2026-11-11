// Keeps the GPU time of each pass for recent frames, and matches the two passes up by frame.
import { median, percentile } from './numbers';

export type PassName = 'volume' | 'image';

export interface FrameSample {
  frame: number;
  volume?: number;
  image?: number;
}

export interface PassSummary {
  n: number;
  median: number;
  p95: number;
}

export class LiveHistory {
  readonly samples: FrameSample[] = [];

  constructor(
    private capacity: number,
    private warmupFrames: number,
  ) {}

  add(frame: number, pass: PassName, ms: number): void {
    // Warmup frames are not representative: the T05 probe showed readings still settling.
    if (frame < this.warmupFrames) return;
    let sample = this.samples.find((candidate) => candidate.frame === frame);
    if (!sample) {
      sample = { frame };
      this.samples.push(sample);
      if (this.samples.length > this.capacity) this.samples.shift();
    }
    sample[pass] = ms;
  }

  private values(pick: (sample: FrameSample) => number | undefined): number[] {
    return this.samples.map(pick).filter((value): value is number => value !== undefined);
  }

  summary(pick: (sample: FrameSample) => number | undefined): PassSummary {
    const values = this.values(pick);
    return { n: values.length, median: median(values), p95: percentile(values, 0.95) };
  }

  clear(): void {
    this.samples.length = 0;
  }
}

// The two passes added together, only for frames where both results have arrived.
export function totalMs(sample: FrameSample): number | undefined {
  if (sample.volume === undefined || sample.image === undefined) return undefined;
  return sample.volume + sample.image;
}
