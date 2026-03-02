import { describe, expect, test } from 'bun:test';
import { getAuthCookies, hasAuth } from '../helpers/auth';
import { fetchPage } from '../helpers/fetch';

describe.skipIf(!hasAuth())('Owner portal pages', () => {
  describe('layout (header)', () => {
    test('FuzzyCat logo links to /owner/payments', async () => {
      const cookies = await getAuthCookies('owner');
      const { $ } = await fetchPage('/owner/payments', { cookies, followRedirects: true });
      const logoLink = $('header a[href="/owner/payments"]');
      expect(logoLink.length).toBeGreaterThan(0);
      expect(logoLink.text()).toContain('FuzzyCat');
    });

    test('Settings nav link', async () => {
      const cookies = await getAuthCookies('owner');
      const { $ } = await fetchPage('/owner/payments', { cookies, followRedirects: true });
      const settingsLink = $('a[href="/owner/settings"]');
      expect(settingsLink.length).toBeGreaterThan(0);
      expect(settingsLink.text()).toContain('Settings');
    });

    test('Sign Out button', async () => {
      const cookies = await getAuthCookies('owner');
      const { $ } = await fetchPage('/owner/payments', { cookies, followRedirects: true });
      const signOutBtn = $('button:contains("Sign Out")');
      expect(signOutBtn.length).toBeGreaterThan(0);
    });
  });

  describe('/owner/payments', () => {
    test('returns 200 with auth', async () => {
      const cookies = await getAuthCookies('owner');
      const { status } = await fetchPage('/owner/payments', { cookies, followRedirects: true });
      expect(status).toBe(200);
    });

    test('heading and description', async () => {
      const cookies = await getAuthCookies('owner');
      const { $ } = await fetchPage('/owner/payments', { cookies, followRedirects: true });
      expect($('h1').text()).toContain('My Payment Plans');
      expect($('body').text()).toContain('Track your payment progress and upcoming installments');
    });
  });

  describe('/owner/settings', () => {
    test('returns 200 with auth', async () => {
      const cookies = await getAuthCookies('owner');
      const { status } = await fetchPage('/owner/settings', { cookies, followRedirects: true });
      expect(status).toBe(200);
    });

    test('heading and description', async () => {
      const cookies = await getAuthCookies('owner');
      const { $ } = await fetchPage('/owner/settings', { cookies, followRedirects: true });
      expect($('h1').text()).toContain('Account Settings');
      expect($('body').text()).toContain(
        'Manage your profile, payment method, and plan agreements',
      );
    });
  });
});
