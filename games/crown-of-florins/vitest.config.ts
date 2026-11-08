import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'crown-of-florins',
    include: ['tests/**/*.test.ts'],
    environment: 'happy-dom',
  },
});
