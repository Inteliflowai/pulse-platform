import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', '.next', 'src/tests'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
      },
    },
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx', '__tests__/**/*.test.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
