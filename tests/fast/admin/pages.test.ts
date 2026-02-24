import { describe, expect, test } from 'bun:test';
import { getAuthCookies } from '../helpers/auth';
import { fetchPage } from '../helpers/fetch';

describe('Admin portal pages', () => {
  describe('layout (sidebar)', () => {
    test('sidebar nav links', async () => {
      const cookies = await getAuthCookies('admin');
      const { $ } = await fetchPage('/admin/dashboard', { cookies, followRedirects: true });
      const navLinks = [
        { href: '/admin/dashboard', label: 'Dashboard' },
        { href: '/admin/clinics', label: 'Clinics' },
        { href: '/admin/payments', label: 'Payments' },
        { href: '/admin/risk', label: 'Platform Reserve' },
      ];
      for (const { href, label } of navLinks) {
        const link = $(`a[href="${href}"]`);
        expect(link.length).toBeGreaterThan(0);
        expect(link.text()).toContain(label);
      }
    });

    test('FuzzyCat Admin brand', async () => {
      const cookies = await getAuthCookies('admin');
      const { $ } = await fetchPage('/admin/dashboard', { cookies, followRedirects: true });
      expect($('body').text()).toContain('FuzzyCat Admin');
    });

    test('Sign Out button', async () => {
      const cookies = await getAuthCookies('admin');
      const { $ } = await fetchPage('/admin/dashboard', { cookies, followRedirects: true });
      const signOutBtn = $('button:contains("Sign Out")');
      expect(signOutBtn.length).toBeGreaterThan(0);
    });
  });

  describe('/admin/dashboard', () => {
    test('returns 200 with auth', async () => {
      const cookies = await getAuthCookies('admin');
      const { status } = await fetchPage('/admin/dashboard', { cookies, followRedirects: true });
      expect(status).toBe(200);
    });

    test('heading and description', async () => {
      const cookies = await getAuthCookies('admin');
      const { $ } = await fetchPage('/admin/dashboard', { cookies, followRedirects: true });
      expect($('h1').text()).toContain('Admin Dashboard');
      expect($('body').text()).toContain('Platform-wide metrics and recent activity');
    });
  });

  describe('/admin/clinics', () => {
    test('returns 200 with auth', async () => {
      const cookies = await getAuthCookies('admin');
      const { status } = await fetchPage('/admin/clinics', { cookies, followRedirects: true });
      expect(status).toBe(200);
    });

    test('heading and description', async () => {
      const cookies = await getAuthCookies('admin');
      const { $ } = await fetchPage('/admin/clinics', { cookies, followRedirects: true });
      expect($('h1').text()).toContain('Manage Clinics');
      expect($('body').text()).toContain(
        'Review, approve, and manage registered veterinary clinics',
      );
    });
  });

  describe('/admin/payments', () => {
    test('returns 200 with auth', async () => {
      const cookies = await getAuthCookies('admin');
      const { status } = await fetchPage('/admin/payments', { cookies, followRedirects: true });
      expect(status).toBe(200);
    });

    test('heading and description', async () => {
      const cookies = await getAuthCookies('admin');
      const { $ } = await fetchPage('/admin/payments', { cookies, followRedirects: true });
      expect($('h1').text()).toContain('Payment Monitoring');
      expect($('body').text()).toContain('Track and manage all payments across the platform');
    });
  });

  describe('/admin/risk', () => {
    test('returns 200 with auth', async () => {
      const cookies = await getAuthCookies('admin');
      const { status } = await fetchPage('/admin/risk', { cookies, followRedirects: true });
      expect(status).toBe(200);
    });

    test('heading and description', async () => {
      const cookies = await getAuthCookies('admin');
      const { $ } = await fetchPage('/admin/risk', { cookies, followRedirects: true });
      expect($('h1').text()).toContain('Platform Reserve');
      expect($('body').text()).toContain(
        'Monitor the platform reserve, coverage health, and defaulted plans',
      );
    });
  });
});
