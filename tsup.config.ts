import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'index.ts',
    'types/index': 'src/types/index.ts',
    'domain-language/index': 'src/domain-language/index.ts'
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  outDir: 'dist',
});
