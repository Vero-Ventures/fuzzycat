import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

loadEnvConfig(process.cwd());

const BASE_URL = 'https://www.fuzzycatapp.com';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 1,
  workers: 8,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list'],
  ],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'public',
      testDir: './e2e/tests/public',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'auth',
      testDir: './e2e/tests/auth',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'owner',
      testDir: './e2e/tests/owner',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/auth-state/owner.json',
      },
    },
    {
      name: 'clinic',
      testDir: './e2e/tests/clinic',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/auth-state/clinic.json',
      },
    },
    {
      name: 'admin',
      testDir: './e2e/tests/admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/auth-state/admin.json',
      },
    },
    {
      name: 'api',
      testDir: './e2e/tests/api',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'cross-cutting',
      testDir: './e2e/tests/cross-cutting',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      testDir: './e2e/tests/cross-cutting',
      testMatch: 'responsive*.spec.ts',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-portal',
      testDir: './e2e/tests/mobile',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'edge-cases',
      testDir: './e2e/tests/edge-cases',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'production-public',
      testDir: './e2e/tests/production',
      testMatch: 'public-pages.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'production-auth',
      testDir: './e2e/tests/production',
      testMatch: 'login-flow.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer — tests hit production directly
});
