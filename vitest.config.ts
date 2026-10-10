// One `pnpm test` runs every workspace project: the kit, the Hall and each simulation.
// Each project keeps its own vitest.config.ts so it can choose its test environment.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'hall', 'games/*'],
  },
});
