import { describe, expect, test } from 'bun:test';
import { getAuthCookies, hasAuth } from '../helpers/auth';
import { fetchPage } from '../helpers/fetch';

describe.skipIf(!hasAuth())('Owner portal pages', () => {
  describe('layout (header)', () => {
    test('FuzzyCat logo links to /client/payments', async () => {
      const cookies = await getAuthCookies('client');
      const { $ } = await fetchPage('/client/payments', { cookies, followRedirects: true });
      const logoLink = $('header a[href="/client/payments"]');
      expect(logoLink.length).toBeGreaterThan(0);
      expect(logoLink.text()).toContain('FuzzyCat');
    });

    test('Settings nav link', async () => {
      const cookies = await getAuthCookies('client');
      const { $ } = await fetchPage('/client/payments', { cookies, followRedirects: true });
      const settingsLink = $('a[href="/client/settings"]');
      expect(settingsLink.length).toBeGreaterThan(0);
      expect(settingsLink.text()).toContain('Settings');
    });

    test('Sign Out button', async () => {
      const cookies = await getAuthCookies('client');
      const { $ } = await fetchPage('/client/payments', { cookies, followRedirects: true });
      const signOutBtn = $('button:contains("Sign Out")');
      expect(signOutBtn.length).toBeGreaterThan(0);
    });
  });

  describe('/client/payments', () => {
    test('returns 200 with auth', async () => {
      const cookies = await getAuthCookies('client');
      const { status } = await fetchPage('/client/payments', { cookies, followRedirects: true });
      expect(status).toBe(200);
    });

    test('heading and description', async () => {
      const cookies = await getAuthCookies('client');
      const { $ } = await fetchPage('/client/payments', { cookies, followRedirects: true });
      expect($('h1').text()).toContain('My Payment Plans');
      expect($('body').text()).toContain('Track your payment progress and upcoming installments');
    });
  });

  describe('/client/settings', () => {
    test('returns 200 with auth', async () => {
      const cookies = await getAuthCookies('client');
      const { status } = await fetchPage('/client/settings', { cookies, followRedirects: true });
      expect(status).toBe(200);
    });

    test('heading and description', async () => {
      const cookies = await getAuthCookies('client');
      const { $ } = await fetchPage('/client/settings', { cookies, followRedirects: true });
      expect($('h1').text()).toContain('Account Settings');
      expect($('body').text()).toContain(
        'Manage your profile, payment method, and plan agreements',
      );
    });
  });
});
