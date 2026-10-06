import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // The account test shares one sandboxed ~/.ssh across its cases.
    fileParallelism: false,
  },
});
