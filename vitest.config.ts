import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      'reference-repos/**',
    ],
  },
  resolve: {
    alias: {
      '@/': './src/',
    },
  },
  esbuild: {
    target: 'esnext',
  },
});
