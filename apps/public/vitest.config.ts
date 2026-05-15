import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Resolve @tukio/contracts subpath exports for Vitest (Vite doesn't follow
      // package.json `exports` field subpaths automatically in all cases).
      '@tukio/contracts/types/Acquisition': fileURLToPath(
        new URL('../../packages/contracts/src/types/Acquisition.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
});
