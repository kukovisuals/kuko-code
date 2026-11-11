/// <reference types="node" />
// Streams the dev server's own traffic and this Mac's counters to the city at /__live/events.
// It only exists under npm run dev, and sampling only runs while a page is listening.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Plugin } from 'vite';
import type { FeedEvent, FileReadEvent, HttpEvent } from '../src/shared/liveEvents';
import { createHardwareSampler } from './hardwareSampler';
import { serveShaderFile, shaderFileName } from './shaderFiles';

const FEED_PATH = '/__live/events';
const SAMPLE_INTERVAL_MS = 500;
// A page only opens the feed once its own files have loaded, so recent requests are kept to send it.
const RECENT_REQUESTS = 300;

function pathOnly(url: string | undefined): string {
  return new URL(url ?? '/', 'http://local').pathname;
}

export function liveFeedPlugin(): Plugin {
  return {
    name: 'live-feed',
    configureServer(server) {
      const clients = new Set<ServerResponse>();
      const recent: (HttpEvent | FileReadEvent)[] = [];
      let timer: NodeJS.Timeout | null = null;
      // Each sampling loop gets a number, so a loop still waiting on its tools can tell it was replaced.
      let currentLoop = 0;

      const serverPort = () => (server.httpServer?.address() as AddressInfo | null)?.port ?? 0;
      const send = (client: ServerResponse, event: FeedEvent) => client.write(`data: ${JSON.stringify(event)}\n\n`);
      const broadcast = (event: FeedEvent) => clients.forEach((client) => send(client, event));
      const feedPorts = () => new Set([...clients].flatMap((client) => client.socket?.remotePort ?? []));

      const stopSampling = () => {
        currentLoop += 1;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      };

      const startSampling = () => {
        if (timer) {
          return;
        }
        currentLoop += 1;
        const loop = currentLoop;
        const sample = createHardwareSampler(serverPort(), feedPorts);
        // The next sample is only scheduled after this one ends, so slow tools can't pile up.
        const tick = async () => {
          const event = await sample();
          if (loop !== currentLoop) {
            return;
          }
          broadcast(event);
          timer = setTimeout(() => void tick(), SAMPLE_INTERVAL_MS);
        };
        timer = setTimeout(() => void tick(), SAMPLE_INTERVAL_MS);
      };

      const openFeed = (req: IncomingMessage, res: ServerResponse) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        recent.forEach((event) => send(res, event));
        clients.add(res);
        req.on('close', () => {
          clients.delete(res);
          if (clients.size === 0) {
            stopSampling();
          }
        });
        startSampling();
      };

      const remember = (event: HttpEvent | FileReadEvent) => {
        recent.push(event);
        if (recent.length > RECENT_REQUESTS) {
          recent.shift();
        }
        broadcast(event);
      };

      const logRequest = (req: IncomingMessage, res: ServerResponse) => {
        const startedAt = performance.now();
        const { socket } = req;
        const bytesBefore = socket.bytesWritten;
        const path = pathOnly(req.url);
        res.on('finish', () => {
          const event: HttpEvent = {
            type: 'http',
            at: Date.now(),
            method: req.method ?? '?',
            path,
            status: res.statusCode,
            bytes: socket.bytesWritten - bytesBefore,
            serverMs: performance.now() - startedAt,
            serverPort: serverPort(),
            clientPort: socket.remotePort ?? 0,
          };
          remember(event);
        });
      };

      server.middlewares.use((req, res, next) => {
        if (pathOnly(req.url) === FEED_PATH) {
          openFeed(req, res);
          return;
        }
        logRequest(req, res);
        const shaderFile = req.method === 'GET' ? shaderFileName(req.url) : null;
        if (shaderFile) {
          void serveShaderFile(server.config.root, shaderFile, res, remember).then((served) => {
            if (!served) {
              next();
            }
          });
          return;
        }
        next();
      });

      server.httpServer?.on('close', () => {
        stopSampling();
        clients.forEach((client) => client.end());
      });
    },
  };
}
