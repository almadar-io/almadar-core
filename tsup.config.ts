import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'index.ts',
    'types/index': 'src/types/index.ts',
    'factory/index': 'src/factory/index.ts',
    'factory-runtime/index': 'src/factory-runtime/index.ts',
    'state-machine/index': 'src/state-machine/index.ts',
    'builders': 'src/builders.ts'
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  outDir: 'dist',
});
