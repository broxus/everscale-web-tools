import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker';
import * as path from 'path';

export default defineConfig({
  plugins: [
    react(),
    checker({
      typescript: true
    })
  ],
  publicDir: path.resolve(__dirname, 'public'),
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'core/pkg')
    }
  }
});
