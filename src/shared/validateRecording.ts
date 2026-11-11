import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../../schema/recording.schema.json';
import type { HardwareMap, Recording } from './types';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const ajv = new Ajv2020({ strict: true, allowUnionTypes: true, allErrors: true });
addFormats(ajv);

const checkSchema = ajv.compile(schema);
const checkHardwareMap = ajv.compile({ $ref: `${schema.$id}#/$defs/hardwareMap` });

// A serial has no fixed shape, so the real protection is that the recorder never reads one.
const IDENTIFIER_PATTERNS = [
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  /[0-9a-f]{8}-[0-9a-f]{16}/i,
];

function formatAjvErrors(errors: typeof checkSchema.errors): string[] {
  return (errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`);
}

function findStopProblems(recording: Recording): string[] {
  const problems: string[] = [];
  for (let stop = 1; stop <= 8; stop += 1) {
    const count = recording.stops.filter((entry) => entry.stop === stop).length;
    if (count !== 1) {
      problems.push(`stop ${stop} appears ${count} times, expected exactly once`);
    }
  }
  return problems;
}

function findFloorProblems(recording: Recording): string[] {
  const problems: string[] = [];
  for (const stop of recording.stops) {
    for (const floorId of stop.floors) {
      const metric = stop.metrics.find((entry) => entry.id === floorId);
      if (!metric) {
        problems.push(`stop ${stop.stop} floor "${floorId}" names a missing metric`);
      } else if (metric.unit !== 'ms') {
        problems.push(`stop ${stop.stop} floor "${floorId}" is in ${metric.unit}, floors must be ms`);
      }
    }
  }
  return problems;
}

function findIdentifierStrings(value: unknown, path = ''): string[] {
  if (typeof value === 'string') {
    const isIdentifier = IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value));
    return isIdentifier ? [`${path || '/'} contains identifier-shaped text`] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findIdentifierStrings(item, `${path}/${index}`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => findIdentifierStrings(item, `${path}/${key}`));
  }
  return [];
}

export function validateRecording(data: unknown): ValidationResult<Recording> {
  if (!checkSchema(data)) {
    return { ok: false, errors: formatAjvErrors(checkSchema.errors) };
  }
  const recording = data as unknown as Recording;
  const errors = [
    ...findStopProblems(recording),
    ...findFloorProblems(recording),
    ...findIdentifierStrings(recording),
  ];
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: recording };
}

export function validateHardwareMap(data: unknown): ValidationResult<HardwareMap> {
  if (!checkHardwareMap(data)) {
    return { ok: false, errors: formatAjvErrors(checkHardwareMap.errors) };
  }
  return { ok: true, value: data as unknown as HardwareMap };
}
