import { test as base } from '@playwright/test';

/** Patterns for console messages that are safe to ignore. */
const IGNORED_CONSOLE_PATTERNS = [
  /posthog/i,
  /sentry/i,
  /favicon\.ico/,
  /\[Fast Refresh\]/,
  /Download the React DevTools/,
  /hydration/i,
];

export const test = base.extend<{
  consoleErrors: string[];
  networkFailures: string[];
  responseErrors: Array<{ url: string; status: number }>;
  attachLogs: () => Promise<void>;
}>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (IGNORED_CONSOLE_PATTERNS.some((p) => p.test(text))) return;
      errors.push(text);
    });
    await use(errors);
  },

  networkFailures: async ({ page }, use) => {
    const failures: string[] = [];
    page.on('requestfailed', (req) => {
      const url = req.url();
      // Ignore analytics/monitoring failures
      if (/posthog|sentry|favicon/i.test(url)) return;
      failures.push(`${req.method()} ${url} — ${req.failure()?.errorText}`);
    });
    await use(failures);
  },

  responseErrors: async ({ page }, use) => {
    const errors: Array<{ url: string; status: number }> = [];
    page.on('response', (res) => {
      if (res.status() >= 400) {
        const url = res.url();
        if (/posthog|sentry|favicon/i.test(url)) return;
        errors.push({ url, status: res.status() });
      }
    });
    await use(errors);
  },

  attachLogs: async ({ page: _page }, use, testInfo) => {
    const fn = async () => {
      // Logs are captured by the fixtures above; this attaches them to the report
      // (Accessed via closure by the test if needed)
    };
    await use(fn);
    // Auto-attach if test failed
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('test-failure-info', {
        body: `Test failed: ${testInfo.title}`,
        contentType: 'text/plain',
      });
    }
  },
});
