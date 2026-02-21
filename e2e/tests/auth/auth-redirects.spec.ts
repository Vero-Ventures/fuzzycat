import { expect, test } from '@playwright/test';

const protectedRoutes = [
  '/owner/payments',
  '/owner/enroll',
  '/owner/enroll/success',
  '/owner/settings',
  '/clinic/dashboard',
  '/clinic/onboarding',
  '/clinic/clients',
  '/clinic/payouts',
  '/clinic/reports',
  '/clinic/settings',
  '/admin/dashboard',
  '/admin/clinics',
  '/admin/payments',
];

test.describe('Protected Route Redirects', () => {
  for (const route of protectedRoutes) {
    test(`redirects ${route} to login with redirectTo parameter`, async ({ page }, testInfo) => {
      await page.goto(route);

      // Should redirect to the login page
      await expect(page).toHaveURL(/\/login/);

      // The URL should contain the redirectTo parameter with the original route
      const encodedRoute = encodeURIComponent(route);
      const currentUrl = page.url();
      expect(currentUrl).toContain(`redirectTo=${encodedRoute}`);

      await testInfo.attach(`redirect-${route.replace(/\//g, '-')}`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });
  }
});
