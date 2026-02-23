import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

// Load .env.local so Playwright (global-setup, tests) can access
// SUPABASE, E2E_TEST_PASSWORD, and other env vars that Next.js
// normally loads automatically.
loadEnvConfig(process.cwd());

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI
    ? [
        ['github'],
        ['json', { outputFile: 'playwright-report/results.json' }],
        ['html', { open: 'never' }],
      ]
    : 'html',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: isCI ? 'on' : 'only-on-failure',
    video: isCI ? 'on-first-retry' : 'off',
  },
  projects: [
    // ── Public pages (no auth) ────────────────────────────────────────
    {
      name: 'public',
      testDir: './e2e/tests/public',
      use: { ...devices['Desktop Chrome'] },
    },
    // ── Auth flows (no auth) ──────────────────────────────────────────
    {
      name: 'auth',
      testDir: './e2e/tests/auth',
      use: { ...devices['Desktop Chrome'] },
    },
    // ── Owner portal (authenticated) ──────────────────────────────────
    {
      name: 'owner',
      testDir: './e2e/tests/owner',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/auth-state/owner.json',
      },
    },
    // ── Clinic portal (authenticated) ─────────────────────────────────
    {
      name: 'clinic',
      testDir: './e2e/tests/clinic',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/auth-state/clinic.json',
      },
    },
    // ── Admin portal (authenticated) ──────────────────────────────────
    {
      name: 'admin',
      testDir: './e2e/tests/admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/auth-state/admin.json',
      },
    },
    // ── API tests ─────────────────────────────────────────────────────
    {
      name: 'api',
      testDir: './e2e/tests/api',
      use: { ...devices['Desktop Chrome'] },
    },
    // ── Cross-cutting (desktop) ───────────────────────────────────────
    {
      name: 'cross-cutting',
      testDir: './e2e/tests/cross-cutting',
      use: { ...devices['Desktop Chrome'] },
    },
    // ── Mobile responsive (public/cross-cutting) ──────────────────────
    {
      name: 'mobile',
      testDir: './e2e/tests/cross-cutting',
      testMatch: 'responsive*.spec.ts',
      use: { ...devices['Pixel 5'] },
    },
    // ── Mobile portal tests (all portals on Pixel 5) ────────────────
    {
      name: 'mobile-portal',
      testDir: './e2e/tests/mobile',
      use: { ...devices['Pixel 5'] },
    },
    // ── Visual regression baselines ─────────────────────────────────
    {
      name: 'visual',
      testDir: './e2e/tests/visual',
      use: { ...devices['Desktop Chrome'] },
    },
    // ── Edge case tests ─────────────────────────────────────────────
    {
      name: 'edge-cases',
      testDir: './e2e/tests/edge-cases',
      use: { ...devices['Desktop Chrome'] },
    },
    // ── Production: public pages ──────────────────────────────────────
    {
      name: 'production-public',
      testDir: './e2e/tests/production',
      testMatch: 'public-pages.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://fuzzycatapp.com',
      },
    },
    // ── Production: auth flow ─────────────────────────────────────────
    {
      name: 'production-auth',
      testDir: './e2e/tests/production',
      testMatch: 'login-flow.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://fuzzycatapp.com',
      },
    },
  ],
  webServer: {
    command: isCI ? 'bun run build && bun run start' : 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
