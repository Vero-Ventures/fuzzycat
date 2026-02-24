import { describe, expect, test } from 'bun:test';
import { getAuthCookies, hasAuth } from '../helpers/auth';
import { fetchPage } from '../helpers/fetch';

// Cold-compiling portal pages can exceed the default 5s timeout
const TIMEOUT = 15_000;

describe.skipIf(!hasAuth())('Role-based access', () => {
  describe('owner cannot access other portals', () => {
    test(
      'owner → /clinic/dashboard redirects',
      async () => {
        const cookies = await getAuthCookies('owner');
        const { status, redirectUrl } = await fetchPage('/clinic/dashboard', { cookies });
        expect(status).toBe(307);
        expect(redirectUrl).toBeTruthy();
        const url = new URL(redirectUrl as string, 'http://localhost:3000');
        expect(url.pathname).toBe('/owner/payments');
      },
      TIMEOUT,
    );

    test(
      'owner → /admin/dashboard redirects',
      async () => {
        const cookies = await getAuthCookies('owner');
        const { status, redirectUrl } = await fetchPage('/admin/dashboard', { cookies });
        expect(status).toBe(307);
        expect(redirectUrl).toBeTruthy();
        const url = new URL(redirectUrl as string, 'http://localhost:3000');
        expect(url.pathname).toBe('/owner/payments');
      },
      TIMEOUT,
    );
  });

  describe('clinic cannot access other portals', () => {
    test(
      'clinic → /owner/payments redirects',
      async () => {
        const cookies = await getAuthCookies('clinic');
        const { status, redirectUrl } = await fetchPage('/owner/payments', { cookies });
        expect(status).toBe(307);
        expect(redirectUrl).toBeTruthy();
        const url = new URL(redirectUrl as string, 'http://localhost:3000');
        expect(url.pathname).toBe('/clinic/dashboard');
      },
      TIMEOUT,
    );

    test(
      'clinic → /admin/dashboard redirects',
      async () => {
        const cookies = await getAuthCookies('clinic');
        const { status, redirectUrl } = await fetchPage('/admin/dashboard', { cookies });
        expect(status).toBe(307);
        expect(redirectUrl).toBeTruthy();
        const url = new URL(redirectUrl as string, 'http://localhost:3000');
        expect(url.pathname).toBe('/clinic/dashboard');
      },
      TIMEOUT,
    );
  });

  describe('authenticated user on auth pages redirects to home', () => {
    test(
      'owner on /login redirects to /owner/payments',
      async () => {
        const cookies = await getAuthCookies('owner');
        const { status, redirectUrl } = await fetchPage('/login', { cookies });
        expect(status).toBe(307);
        expect(redirectUrl).toBeTruthy();
        const url = new URL(redirectUrl as string, 'http://localhost:3000');
        expect(url.pathname).toBe('/owner/payments');
      },
      TIMEOUT,
    );

    test(
      'clinic on /login redirects to /clinic/dashboard',
      async () => {
        const cookies = await getAuthCookies('clinic');
        const { status, redirectUrl } = await fetchPage('/login', { cookies });
        expect(status).toBe(307);
        expect(redirectUrl).toBeTruthy();
        const url = new URL(redirectUrl as string, 'http://localhost:3000');
        expect(url.pathname).toBe('/clinic/dashboard');
      },
      TIMEOUT,
    );

    test(
      'admin on /login redirects to /admin/dashboard',
      async () => {
        const cookies = await getAuthCookies('admin');
        const { status, redirectUrl } = await fetchPage('/login', { cookies });
        expect(status).toBe(307);
        expect(redirectUrl).toBeTruthy();
        const url = new URL(redirectUrl as string, 'http://localhost:3000');
        expect(url.pathname).toBe('/admin/dashboard');
      },
      TIMEOUT,
    );
  });
});
