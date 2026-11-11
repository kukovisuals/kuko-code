import { defineConfig, type Plugin } from 'vite';
import { liveFeedPlugin } from './server/liveFeedPlugin';

// Stop 1 times the shader fetch, so a cached response would time the wrong thing.
function noStoreShaders(): Plugin {
  return {
    name: 'no-store-shaders',
    configureServer(server) {
      server.middlewares.use('/shaders/', (_req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [noStoreShaders(), liveFeedPlugin()],
  server: {
    // Cross-origin isolation improves performance.now() from 100 µs to 5 µs.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    rolldownOptions: {
      input: {
        city: 'index.html',
        record: 'record.html',
        shader: 'shader.html',
        program: 'program.html',
      },
    },
  },
});
