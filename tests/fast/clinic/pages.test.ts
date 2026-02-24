import { describe, expect, test } from 'bun:test';
import { getAuthCookies, hasAuth } from '../helpers/auth';
import { fetchPage } from '../helpers/fetch';

describe.skipIf(!hasAuth())('Clinic portal pages', () => {
  describe('layout (sidebar)', () => {
    test('sidebar nav links', async () => {
      const cookies = await getAuthCookies('clinic');
      const { $ } = await fetchPage('/clinic/dashboard', { cookies, followRedirects: true });
      const navLinks = [
        { href: '/clinic/dashboard', label: 'Dashboard' },
        { href: '/clinic/clients', label: 'Clients' },
        { href: '/clinic/payouts', label: 'Payouts' },
        { href: '/clinic/reports', label: 'Reports' },
        { href: '/clinic/settings', label: 'Settings' },
      ];
      for (const { href, label } of navLinks) {
        const link = $(`a[href="${href}"]`);
        expect(link.length).toBeGreaterThan(0);
        expect(link.text()).toContain(label);
      }
    });

    test('Sign Out button', async () => {
      const cookies = await getAuthCookies('clinic');
      const { $ } = await fetchPage('/clinic/dashboard', { cookies, followRedirects: true });
      const signOutBtn = $('button:contains("Sign Out")');
      expect(signOutBtn.length).toBeGreaterThan(0);
    });
  });

  describe('/clinic/dashboard', () => {
    test('returns 200 with auth', async () => {
      const cookies = await getAuthCookies('clinic');
      const { status } = await fetchPage('/clinic/dashboard', { cookies, followRedirects: true });
      expect(status).toBe(200);
    });

    test('heading and description', async () => {
      const cookies = await getAuthCookies('clinic');
      const { $ } = await fetchPage('/clinic/dashboard', { cookies, followRedirects: true });
      expect($('h1').text()).toContain('Clinic Dashboard');
      expect($('body').text()).toContain(
        'Manage payment plans, track revenue, and monitor payouts',
      );
    });

    test('Initiate Enrollment link', async () => {
      const cookies = await getAuthCookies('clinic');
      const { $ } = await fetchPage('/clinic/dashboard', { cookies, followRedirects: true });
      const enrollLink = $('a[href="/clinic/enroll"]');
      expect(enrollLink.length).toBeGreaterThan(0);
      expect(enrollLink.text()).toContain('Initiate Enrollment');
    });
  });

  describe('/clinic/clients', () => {
    test('returns 200 with auth', async () => {
      const cookies = await getAuthCookies('clinic');
      const { status } = await fetchPage('/clinic/clients', { cookies, followRedirects: true });
      expect(status).toBe(200);
    });

    test('heading and description', async () => {
      const cookies = await getAuthCookies('clinic');
      const { $ } = await fetchPage('/clinic/clients', { cookies, followRedirects: true });
      expect($('h1').text()).toContain('Clients');
      expect($('body').text()).toContain('View all pet owners with payment plans at your clinic');
    });
  });

  describe('/clinic/payouts', () => {
    test('returns 200 with auth', async () => {
      const cookies = await getAuthCookies('clinic');
      const { status } = await fetchPage('/clinic/payouts', { cookies, followRedirects: true });
      expect(status).toBe(200);
    });

    test('heading and description', async () => {
      const cookies = await getAuthCookies('clinic');
      const { $ } = await fetchPage('/clinic/payouts', { cookies, followRedirects: true });
      expect($('h1').text()).toContain('Payouts');
      expect($('body').text()).toContain(
        'Track your payout history and revenue earned through FuzzyCat',
      );
    });
  });

  describe('/clinic/reports', () => {
    test('returns 200 with auth', async () => {
      const cookies = await getAuthCookies('clinic');
      const { status } = await fetchPage('/clinic/reports', { cookies, followRedirects: true });
      expect(status).toBe(200);
    });

    test('heading and description', async () => {
      const cookies = await getAuthCookies('clinic');
      const { $ } = await fetchPage('/clinic/reports', { cookies, followRedirects: true });
      expect($('h1').text()).toContain('Reports');
      expect($('body').text()).toContain(
        'View revenue reports, enrollment trends, and export your data',
      );
    });
  });

  describe('/clinic/settings', () => {
    test('returns 200 with auth', async () => {
      const cookies = await getAuthCookies('clinic');
      const { status } = await fetchPage('/clinic/settings', { cookies, followRedirects: true });
      expect(status).toBe(200);
    });

    test('heading and description', async () => {
      const cookies = await getAuthCookies('clinic');
      const { $ } = await fetchPage('/clinic/settings', { cookies, followRedirects: true });
      expect($('h1').text()).toContain('Clinic Settings');
      expect($('body').text()).toContain(
        'Manage your clinic information, payment account, and security',
      );
    });
  });

  describe('/clinic/onboarding', () => {
    test('returns 200 with auth', async () => {
      const cookies = await getAuthCookies('clinic');
      const { status } = await fetchPage('/clinic/onboarding', { cookies, followRedirects: true });
      expect(status).toBe(200);
    });

    test('heading', async () => {
      const cookies = await getAuthCookies('clinic');
      const { $ } = await fetchPage('/clinic/onboarding', { cookies, followRedirects: true });
      expect($('h1').text()).toContain('Welcome to FuzzyCat');
    });
  });

  describe('/clinic/enroll', () => {
    test('returns 200 with auth', async () => {
      const cookies = await getAuthCookies('clinic');
      const { status } = await fetchPage('/clinic/enroll', { cookies, followRedirects: true });
      expect(status).toBe(200);
    });

    test('renders clinic layout', async () => {
      const cookies = await getAuthCookies('clinic');
      const { $ } = await fetchPage('/clinic/enroll', { cookies, followRedirects: true });
      // Enroll page content is client-rendered; verify the sidebar layout loads
      expect($('a[href="/clinic/dashboard"]').length).toBeGreaterThan(0);
    });
  });
});
