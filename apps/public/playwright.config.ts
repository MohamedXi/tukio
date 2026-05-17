import { defineConfig, devices } from '@playwright/test';

/**
 * Tukio public app — Playwright config (Story 1.3d).
 *
 * Story 1.2d shipped its first e2e spec without a config; this is the canonical
 * harness for both customer + pro registration specs. Projects intentionally
 * dual-locale (`chromium-fr` + `chromium-en`) so any spec can target a single
 * project via `--grep` or `--project=`.
 *
 * Run prereqs (see story Dev Notes):
 *   pnpm docker:up:wait                            # postgres + keycloak + nats + r2 stub
 *   pnpm --filter=identity-svc start:dev           # 4001
 *   pnpm --filter=gateway-api start:dev            # 4000
 *   pnpm --filter=public dev                       # 3000
 *
 * Then:
 *   pnpm --filter=public exec playwright test
 *   pnpm --filter=public exec playwright test --grep "pro register"
 */

const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium-fr',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'fr-FR',
      },
    },
    {
      name: 'chromium-en',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'en-US',
      },
    },
  ],
});
