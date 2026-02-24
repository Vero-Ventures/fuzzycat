import { describe, expect, test } from 'bun:test';
import { getAuthCookies } from '../helpers/auth';
import { fetchPage } from '../helpers/fetch';

describe('Role-based access', () => {
  describe('owner cannot access other portals', () => {
    test('owner → /clinic/dashboard redirects', async () => {
      const cookies = await getAuthCookies('owner');
      const { status, redirectUrl } = await fetchPage('/clinic/dashboard', { cookies });
      expect(status).toBe(307);
      expect(redirectUrl).toBeTruthy();
      const url = new URL(redirectUrl as string, 'http://localhost:3000');
      expect(url.pathname).toBe('/owner/payments');
    });

    test('owner → /admin/dashboard redirects', async () => {
      const cookies = await getAuthCookies('owner');
      const { status, redirectUrl } = await fetchPage('/admin/dashboard', { cookies });
      expect(status).toBe(307);
      expect(redirectUrl).toBeTruthy();
      const url = new URL(redirectUrl as string, 'http://localhost:3000');
      expect(url.pathname).toBe('/owner/payments');
    });
  });

  describe('clinic cannot access other portals', () => {
    test('clinic → /owner/payments redirects', async () => {
      const cookies = await getAuthCookies('clinic');
      const { status, redirectUrl } = await fetchPage('/owner/payments', { cookies });
      expect(status).toBe(307);
      expect(redirectUrl).toBeTruthy();
      const url = new URL(redirectUrl as string, 'http://localhost:3000');
      expect(url.pathname).toBe('/clinic/dashboard');
    });

    test('clinic → /admin/dashboard redirects', async () => {
      const cookies = await getAuthCookies('clinic');
      const { status, redirectUrl } = await fetchPage('/admin/dashboard', { cookies });
      expect(status).toBe(307);
      expect(redirectUrl).toBeTruthy();
      const url = new URL(redirectUrl as string, 'http://localhost:3000');
      expect(url.pathname).toBe('/clinic/dashboard');
    });
  });

  describe('authenticated user on auth pages redirects to home', () => {
    test('owner on /login redirects to /owner/payments', async () => {
      const cookies = await getAuthCookies('owner');
      const { status, redirectUrl } = await fetchPage('/login', { cookies });
      expect(status).toBe(307);
      expect(redirectUrl).toBeTruthy();
      const url = new URL(redirectUrl as string, 'http://localhost:3000');
      expect(url.pathname).toBe('/owner/payments');
    });

    test('clinic on /login redirects to /clinic/dashboard', async () => {
      const cookies = await getAuthCookies('clinic');
      const { status, redirectUrl } = await fetchPage('/login', { cookies });
      expect(status).toBe(307);
      expect(redirectUrl).toBeTruthy();
      const url = new URL(redirectUrl as string, 'http://localhost:3000');
      expect(url.pathname).toBe('/clinic/dashboard');
    });

    test('admin on /login redirects to /admin/dashboard', async () => {
      const cookies = await getAuthCookies('admin');
      const { status, redirectUrl } = await fetchPage('/login', { cookies });
      expect(status).toBe(307);
      expect(redirectUrl).toBeTruthy();
      const url = new URL(redirectUrl as string, 'http://localhost:3000');
      expect(url.pathname).toBe('/admin/dashboard');
    });
  });
});
