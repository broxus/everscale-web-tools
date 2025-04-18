import { defineConfig, Plugin, ViteDevServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import checker from 'vite-plugin-checker';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import * as path from 'path';
import fs from 'fs';

export const disasmVite = (): Plugin => {
  return {
    name: 'disasm-wasm-vite',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (req?.url?.endsWith('tycho_disasm_bg.wasm')) {
          const wasmPath = path.resolve(__dirname, './node_modules/@tychosdk/disasm/dist/wasm/tycho_disasm_bg.wasm');

          const wasmFile = fs.readFileSync(wasmPath);
          res.setHeader('Content-Type', 'application/wasm');
          res.end(wasmFile);
          return;
        }

        next();
      });
    }
  };
};

export default defineConfig({
  plugins: [
    vue(),
    checker({
      typescript: true
    }),
    nodePolyfills(),
    disasmVite()
  ],
  publicDir: path.resolve(__dirname, 'public'),
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'core/pkg'),
      '@debugger': path.resolve(__dirname, 'debugger/pkg')
    }
  },
  envPrefix: 'BYTIE_',
  build: {
    target: 'es2020'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020'
    }
  }
});
