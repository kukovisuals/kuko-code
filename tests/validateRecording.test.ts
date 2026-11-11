import { describe, expect, it } from 'vitest';
import hardwareMap from '../data/hardware-map.m2.json';
import { validateHardwareMap, validateRecording } from '../src/shared/validateRecording';
import type { Recording } from '../src/shared/types';
import fixture from './fixtures/valid-recording.json';

function freshRecording(): Recording {
  return structuredClone(fixture) as unknown as Recording;
}

function errorsFor(mutate: (recording: Recording) => void): string[] {
  const recording = freshRecording();
  mutate(recording);
  const result = validateRecording(recording);
  return result.ok ? [] : result.errors;
}

describe('validateRecording', () => {
  it('accepts a valid recording', () => {
    expect(validateRecording(freshRecording()).ok).toBe(true);
  });

  it('rejects a recording with only 1 stop', () => {
    const errors = errorsFor((recording) => {
      recording.stops = recording.stops.slice(0, 1);
    });
    expect(errors.join()).toContain('must NOT have fewer than 8 items');
  });

  it('rejects an injected serial key', () => {
    const errors = errorsFor((recording) => {
      (recording.environment as unknown as Record<string, unknown>).serial = 'abc';
    });
    expect(errors.join()).toContain('must NOT have additional properties');
  });

  it('rejects a bad status', () => {
    const errors = errorsFor((recording) => {
      (recording.stops[0] as unknown as { status: string }).status = 'guessed';
    });
    expect(errors.join()).toContain('must be equal to one of the allowed values');
  });

  it('rejects an absolute shader path', () => {
    const errors = errorsFor((recording) => {
      recording.shader.file = '/Users/someone/shaders/a.glsl';
    });
    expect(errors.join()).toContain('must match pattern');
  });

  it('rejects a duplicate stop', () => {
    const errors = errorsFor((recording) => {
      recording.stops[1].stop = 1;
    });
    expect(errors).toContain('stop 1 appears 2 times, expected exactly once');
    expect(errors).toContain('stop 2 appears 0 times, expected exactly once');
  });

  it('rejects a floor naming a missing metric', () => {
    const errors = errorsFor((recording) => {
      recording.stops[0].floors = ['nope'];
    });
    expect(errors).toContain('stop 1 floor "nope" names a missing metric');
  });

  it('rejects a floor naming a non-ms metric', () => {
    const errors = errorsFor((recording) => {
      recording.stops[4].floors = ['stepCount'];
    });
    expect(errors).toContain('stop 5 floor "stepCount" is in count, floors must be ms');
  });

  it('rejects a UUID inside a note', () => {
    const errors = errorsFor((recording) => {
      recording.stops[0].metrics[0].note = 'ran on 12345678-1234-1234-1234-123456789abc';
    });
    expect(errors).toContain('/stops/0/metrics/0/note contains identifier-shaped text');
  });

  it('rejects a UDID inside a note', () => {
    const errors = errorsFor((recording) => {
      recording.stops[0].metrics[0].note = 'ran on 00008112-001A2B3C4D5E6F70';
    });
    expect(errors).toContain('/stops/0/metrics/0/note contains identifier-shaped text');
  });
});

describe('hardware map', () => {
  it('passes the schema definition', () => {
    expect(validateHardwareMap(hardwareMap).ok).toBe(true);
  });

  it('has a non-empty source on every number', () => {
    const numbers = hardwareMap.blocks.flatMap((block) => block.numbers);
    expect(numbers.length).toBeGreaterThan(0);
    for (const number of numbers) {
      expect(number.source.trim()).not.toBe('');
    }
  });
});
