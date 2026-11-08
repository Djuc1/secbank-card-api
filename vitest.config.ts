import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/accounts/**/*.ts',
        'src/cards/**/*.ts',
        'src/common/**/*.ts',
      ],
      exclude: [
        '**/*.spec.ts',
        '**/*.d.ts',
      ],
      reporter: ['text', 'html'],
    },
  },
});
