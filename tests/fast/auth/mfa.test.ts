import { describe, expect, test } from 'bun:test';
import { fetchPage } from '../helpers/fetch';

describe('MFA pages', () => {
  describe('/mfa/setup', () => {
    test('returns 200', async () => {
      const { status } = await fetchPage('/mfa/setup');
      expect(status).toBe(200);
    });

    test('heading', async () => {
      const { $ } = await fetchPage('/mfa/setup');
      expect($('h1').text()).toContain('Set up two-factor authentication');
    });

    test('verification code input', async () => {
      const { $ } = await fetchPage('/mfa/setup');
      const codeInput = $('input[name="code"]');
      expect(codeInput.length).toBeGreaterThan(0);
      expect(codeInput.attr('pattern')).toBe('[0-9]{6}');
    });

    test('submit button', async () => {
      const { $ } = await fetchPage('/mfa/setup');
      const button = $('button[type="submit"]');
      expect(button.text()).toContain('Verify and enable');
    });
  });

  describe('/mfa/verify', () => {
    test('returns 200', async () => {
      const { status } = await fetchPage('/mfa/verify');
      expect(status).toBe(200);
    });

    test('heading', async () => {
      const { $ } = await fetchPage('/mfa/verify');
      expect($('h1').text()).toContain('Two-factor authentication');
    });

    test('verification code input', async () => {
      const { $ } = await fetchPage('/mfa/verify');
      const codeInput = $('input[name="code"]');
      expect(codeInput.length).toBeGreaterThan(0);
      expect(codeInput.attr('pattern')).toBe('[0-9]{6}');
    });

    test('submit button', async () => {
      const { $ } = await fetchPage('/mfa/verify');
      const button = $('button[type="submit"]');
      expect(button.text()).toContain('Verify');
    });
  });
});
