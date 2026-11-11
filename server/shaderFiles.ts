// Serves ./shaders/*.glsl from disk and times the read, so the trip can start at the SSD block.
import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import path from 'node:path';
import type { FileReadEvent } from '../src/shared/liveEvents';

const SHADER_URL = /^\/shaders\/([\w-]+\.glsl)$/;

// Pure. Only a plain request for one file in ./shaders matches. A query string means Vite should handle it.
export function shaderFileName(url: string | undefined): string | null {
  return SHADER_URL.exec(url ?? '')?.[1] ?? null;
}

// Resolves false when the file can't be read, so the caller can hand the request back to Vite.
export async function serveShaderFile(root: string, name: string, res: ServerResponse, onRead: (event: FileReadEvent) => void): Promise<boolean> {
  const startedAt = performance.now();
  let bytes: Buffer;
  try {
    bytes = await readFile(path.join(root, 'shaders', name));
  } catch {
    return false;
  }
  // Covers open, read and close. macOS may answer from its file cache in memory without touching the SSD.
  const ms = performance.now() - startedAt;
  onRead({ type: 'file-read', at: Date.now(), file: `shaders/${name}`, bytes: bytes.length, ms });
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': bytes.length });
  res.end(bytes);
  return true;
}
