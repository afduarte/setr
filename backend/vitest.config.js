import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    // The disk-backed singletons (cache/user data/audiomuse library) read env
    // vars at import time, so module state must not leak between test files.
    pool: 'forks',
    testTimeout: 15000,
  },
});
