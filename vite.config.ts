import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import checker from 'vite-plugin-checker';
import * as path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    checker({
      typescript: true
    })
  ],
  publicDir: path.resolve(__dirname, 'public'),
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'core/pkg'),
      '@debugger': path.resolve(__dirname, 'debugger/pkg')
    }
  },
  envPrefix: 'BYTIE_'
});
