// Turns two Metal System Trace recordings into data/imports/instruments.json, the city's native readings.
// Run: node scripts/importTrace.ts --steady <steady.trace> --reload <reload.trace> --scene "program.html alone"
// The .trace files stay outside the repo: they can hold device identifiers. Only summary numbers are written.
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { driverBuildImport, findIdentifiers, gpuRunImport } from '../server/traceSummary.ts';
import { parseTraceTable, type TraceRow } from '../server/traceTable.ts';

const OUTPUT = resolve(import.meta.dirname, '../data/imports/instruments.json');
const MAX_EXPORT_BYTES = 512 * 1024 * 1024;

function option(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

function exportTable(tracePath: string, schema: string): TraceRow[] {
  const xpath = `/trace-toc/run[@number="1"]/data/table[@schema="${schema}"]`;
  const xml = execFileSync('xcrun', ['xctrace', 'export', '--input', tracePath, '--xpath', xpath], {
    encoding: 'utf8',
    maxBuffer: MAX_EXPORT_BYTES,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return parseTraceTable(xml);
}

const steady = option('steady');
const reload = option('reload');
if (!steady || !reload) {
  console.error('Usage: node scripts/importTrace.ts --steady <trace> --reload <trace> [--scene "what was on screen"]');
  process.exit(1);
}
const scene = option('scene') ?? 'program.html alone in its tab';
// The file's own date, so the import says when the trace was recorded and not when it was imported.
const tracedOn = (path: string) => statSync(path).mtime.toISOString().slice(0, 10);

const imports = [
  gpuRunImport(exportTable(steady, 'metal-gpu-intervals'), { tracedOn: tracedOn(steady), scene }),
  driverBuildImport(exportTable(reload, 'graphics-compiler-activity-intervals'), { tracedOn: tracedOn(reload), scene: `${scene}, across one page reload` }),
];

const leaks = findIdentifiers(imports);
if (leaks.length > 0) {
  console.error(`Refused to write: the import matches identifier shapes ${leaks.join(', ')}`);
  process.exit(1);
}
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(imports, null, 2)}\n`);
for (const entry of imports) {
  for (const metric of entry.metrics) {
    console.log(`stop ${entry.stop}  ${metric.id}: ${metric.value === null ? 'no value' : metric.value.toFixed(3)} ${metric.unit}  n=${metric.stats?.n ?? '-'}  (${metric.status})`);
  }
}
console.log(`Wrote ${OUTPUT}`);
