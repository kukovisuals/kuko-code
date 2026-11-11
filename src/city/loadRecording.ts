// Reads recording files, validates them, and compares them. Invalid data never reaches the scene.
import type { Recording } from '../shared/types';
import { validateRecording, type ValidationResult } from '../shared/validateRecording';

export function parseRecording(text: string): ValidationResult<Recording> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { ok: false, errors: [`Not valid JSON: ${(error as Error).message}`] };
  }
  return validateRecording(data);
}

export async function readRecordingFiles(files: File[]): Promise<ValidationResult<Recording[]>> {
  const recordings: Recording[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const result = parseRecording(await file.text());
    if (result.ok) {
      recordings.push(result.value);
    } else {
      errors.push(...result.errors.map((error) => `${file.name}: ${error}`));
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: recordings };
}

// Comparing displays only means something when everything else matches.
export function compareRecordings(a: Recording, b: Recording): string[] {
  const warnings: string[] = [];
  if (a.shader.sha256 !== b.shader.sha256) {
    warnings.push(`Different shader hashes: ${a.shader.sha256.slice(0, 8)} (${a.shader.file}) and ${b.shader.sha256.slice(0, 8)} (${b.shader.file})`);
  }
  const bufferA = a.capture.drawingBuffer;
  const bufferB = b.capture.drawingBuffer;
  if (bufferA.width !== bufferB.width || bufferA.height !== bufferB.height) {
    warnings.push(`Different buffer sizes: ${bufferA.width} x ${bufferA.height} and ${bufferB.width} x ${bufferB.height}`);
  }
  if (a.capture.cacheState !== b.capture.cacheState) {
    warnings.push(`Different cache states: ${a.capture.cacheState} and ${b.capture.cacheState}`);
  }
  return warnings;
}
