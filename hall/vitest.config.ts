import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'hall',
    include: ['tests/**/*.test.ts'],
    environment: 'happy-dom',
  },
});
