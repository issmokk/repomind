import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    resolve: {
      tsconfigPaths: true,
    },
    test: {
      environment: 'node',
      globals: true,
      include: ['src/lib/rag/__eval__/**/*.test.ts'],
      testTimeout: 600_000,
      env,
    },
  }
})
