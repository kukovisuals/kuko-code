// The native readings written by scripts/importTrace.ts. They were traced at another time, with the city
// closed, so they sit beside the live browser numbers and never replace them.
import instruments from '../../../data/imports/instruments.json';
import type { NativeImport } from '../../shared/types';

export const NATIVE_IMPORTS = instruments as NativeImport[];
