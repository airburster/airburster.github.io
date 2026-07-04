import { defineConfig } from 'vite';

// Served from the root of https://airburster.github.io/, so base is '/'.
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
