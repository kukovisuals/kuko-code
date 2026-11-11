/// <reference types="node" />
// Saves the experiments page's result to one fixed file, so the city can read it later without measuring.
// Dev server only. It writes nothing else and never touches the shader files.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';
import { EXPERIMENT_FILE, EXPERIMENT_SAVE_PATH, EXPERIMENT_SCHEMA } from '../src/shared/experimentResult';

const MAX_BYTES = 512 * 1024;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > MAX_BYTES) reject(new Error('result too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export function experimentStorePlugin(): Plugin {
  return {
    name: 'experiment-store',
    configureServer(server) {
      server.middlewares.use(EXPERIMENT_SAVE_PATH, (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        void readBody(req)
          .then(async (body) => {
            const parsed = JSON.parse(body) as { schema?: unknown };
            if (parsed.schema !== EXPERIMENT_SCHEMA) throw new Error(`expected schema ${EXPERIMENT_SCHEMA}`);
            const path = join(server.config.root, EXPERIMENT_FILE);
            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ saved: EXPERIMENT_FILE }));
          })
          .catch((error: unknown) => {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          });
      });
    },
  };
}
