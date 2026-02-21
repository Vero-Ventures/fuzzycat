import type { Page } from '@playwright/test';
import { test as base } from '@playwright/test';

/** Block Stripe.js from loading and provide a stub. */
async function mockStripe(page: Page) {
  await page.route('**/js.stripe.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.Stripe = function() { return { elements: function() { return { create: function() { return { mount: function() {}, on: function() {} } } } }, confirmPayment: function() { return Promise.resolve({ paymentIntent: { status: "succeeded" } }) }, confirmSetup: function() { return Promise.resolve({ setupIntent: { status: "succeeded" } }) } } };',
    }),
  );
}

/** Block Plaid Link from loading and provide a stub. */
async function mockPlaid(page: Page) {
  await page.route('**/cdn.plaid.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.Plaid = { create: function() { return { open: function() {}, exit: function() {}, destroy: function() {} } } };',
    }),
  );
}

/** Block Turnstile from loading and provide a stub that auto-passes. */
async function mockTurnstile(page: Page) {
  await page.route('**/challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.turnstile = { render: function(el, opts) { if (opts && opts.callback) opts.callback("mock-turnstile-token"); return "mock-widget-id"; }, reset: function() {}, remove: function() {} };',
    }),
  );
}

/** Block analytics scripts (PostHog, Sentry) to prevent test flakiness. */
async function mockAnalytics(page: Page) {
  await page.route('**/us.i.posthog.com/**', (route) => route.fulfill({ status: 200, body: '{}' }));
  await page.route('**/*.ingest.sentry.io/**', (route) =>
    route.fulfill({ status: 200, body: '{}' }),
  );
  await page.route('**/browser.sentry-cdn.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '',
    }),
  );
}

/** Convenience: apply all external service mocks at once. */
async function mockAllExternal(page: Page) {
  await mockStripe(page);
  await mockPlaid(page);
  await mockTurnstile(page);
  await mockAnalytics(page);
}

export const test = base.extend<{
  mockStripe: undefined;
  mockPlaid: undefined;
  mockTurnstile: undefined;
  mockAnalytics: undefined;
  mockAllExternal: undefined;
}>({
  mockStripe: [
    async ({ page }, use) => {
      await mockStripe(page);
      await use(undefined);
    },
    { auto: false },
  ],
  mockPlaid: [
    async ({ page }, use) => {
      await mockPlaid(page);
      await use(undefined);
    },
    { auto: false },
  ],
  mockTurnstile: [
    async ({ page }, use) => {
      await mockTurnstile(page);
      await use(undefined);
    },
    { auto: false },
  ],
  mockAnalytics: [
    async ({ page }, use) => {
      await mockAnalytics(page);
      await use(undefined);
    },
    { auto: false },
  ],
  mockAllExternal: [
    async ({ page }, use) => {
      await mockAllExternal(page);
      await use(undefined);
    },
    { auto: false },
  ],
});
