/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/lib/rag/__eval__/**/*.test.ts'],
    testTimeout: 120_000,
  },
})
