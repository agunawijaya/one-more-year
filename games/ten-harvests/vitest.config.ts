import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'ten-harvests',
    include: ['tests/**/*.test.ts'],
    environment: 'happy-dom',
  },
});
