import { describe, expect, test } from 'bun:test';
import { fetchPage } from '../helpers/fetch';

const PROTECTED_ROUTES = [
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
] as const;

describe('Unauthenticated redirects', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} → 302 to /login`, async () => {
      const { status, redirectUrl } = await fetchPage(route);
      expect(status).toBe(307);
      expect(redirectUrl).toBeTruthy();
      const url = new URL(redirectUrl as string, 'http://localhost:3000');
      expect(url.pathname).toBe('/login');
      expect(url.searchParams.get('redirectTo')).toBe(route);
    });
  }
});
