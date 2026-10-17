import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests for pure library logic (validators, pricing, error mapping, model helpers).
 * Screens are covered by the manual test plans in docs/.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@kitafix/shared-types': fileURLToPath(
        new URL('./libs/shared-types/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['libs/**/*.spec.ts', 'tools/**/*.spec.mjs'],
    environment: 'node',
  },
});
