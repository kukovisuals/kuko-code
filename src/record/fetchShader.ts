// Stop 1: times fetching one shader file from the dev server, and hashes what came back.
import type { Metric, ShaderInfo } from '../shared/types';
import { summarize } from './summarize';

export interface FetchResult {
  metric: Metric;
  shader: ShaderInfo;
  text: string;
  // True when the file is a plain `#version 300 es` fragment shader (D3). Shadertoy-style passes aren't.
  plainFragmentShader: boolean;
}

// Lists the shader paths without loading them: a lazy glob only maps each path to an import that
// is never called here. The files themselves are fetched below, so their load can be timed.
export function listShaderFiles(): string[] {
  const paths = Object.keys(import.meta.glob('/shaders/*.glsl'));
  // Keys look like "/shaders/cost-low.glsl". The schema wants a relative path.
  return paths.map((path) => path.replace(/^\//, '')).sort();
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// The browser can add the timing entry a moment after the body is read, so wait a few tasks for it.
async function timingEntry(url: string): Promise<PerformanceResourceTiming> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const entry = performance.getEntriesByName(url, 'resource').at(-1);
    if (entry) return entry as PerformanceResourceTiming;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`No PerformanceResourceTiming entry for ${url}`);
}

interface OneFetch {
  ms: number;
  bytes: ArrayBuffer;
  servedFromCache: boolean;
}

async function fetchOnce(url: string, file: string): Promise<OneFetch> {
  // Clearing first means the entry read below can only belong to this fetch.
  performance.clearResourceTimings();
  const response = await fetch(url, { cache: 'no-store' });
  const bytes = await response.arrayBuffer();
  const head = new TextDecoder().decode(bytes.slice(0, 64)).trimStart();
  // A missing file can come back as Vite's HTML fallback with status 200, so check the text too.
  if (!response.ok || head.startsWith('<')) {
    throw new Error(`Could not load ${file}. Run this page with npm run dev.`);
  }
  const entry = await timingEntry(url);
  // transferSize 0 with a body means no bytes crossed the connection: a cache answered.
  const servedFromCache = entry.transferSize === 0 && entry.decodedBodySize > 0;
  return { ms: entry.responseEnd - entry.startTime, bytes, servedFromCache };
}

// Says "loopback" only when the page really was opened on this machine's own address.
function pathNote(): string {
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return loopback
    ? 'Loopback only: no Wi-Fi or internet in the path.'
    : 'Opened on a network address, so this is not loopback and may include the local network.';
}

// One fetch after another, never in parallel, so each reading is one file's own trip.
export async function measureFetch(file: string, repeats: number): Promise<FetchResult> {
  const url = new URL(`/${file}`, location.href).href;
  const readings: number[] = [];
  const hashes = new Set<string>();
  let last: OneFetch | null = null;
  for (let run = 0; run < repeats; run += 1) {
    last = await fetchOnce(url, file);
    if (last.servedFromCache) {
      throw new Error(`${file} came from a cache, so the timing would not be the trip. Check the no-store header.`);
    }
    readings.push(last.ms);
    hashes.add(await sha256Hex(last.bytes));
  }
  if (!last) throw new Error('measureFetch needs at least one repeat');
  // A file saved mid-run would mix two different files into one set of stats.
  if (hashes.size !== 1) throw new Error(`${file} changed during the run. Run it again.`);
  const stats = summarize(readings);
  const text = new TextDecoder().decode(last.bytes);
  return {
    metric: {
      id: 'fetchMs',
      value: stats?.median ?? null,
      unit: 'ms',
      status: 'measured',
      source:
        `PerformanceResourceTiming responseEnd minus startTime, ${repeats} fetches one after another ` +
        `with cache: no-store, from the Vite dev server. ${pathNote()}`,
      ...(stats ? { stats } : {}),
    },
    shader: { file, bytes: last.bytes.byteLength, sha256: [...hashes][0] as string },
    text,
    plainFragmentShader: text.startsWith('#version 300 es'),
  };
}
