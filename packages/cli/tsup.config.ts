import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: true,
  external: ['ws'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
