import { describe, expect, test } from 'bun:test';
import { fetchPage } from '../helpers/fetch';

describe('Forgot password page /forgot-password', () => {
  test('returns 200', async () => {
    const { status } = await fetchPage('/forgot-password');
    expect(status).toBe(200);
  });

  test('heading', async () => {
    const { $ } = await fetchPage('/forgot-password');
    expect($('h1').text()).toContain('Reset your password');
  });

  test('email input', async () => {
    const { $ } = await fetchPage('/forgot-password');
    const emailInput = $('input[type="email"]');
    expect(emailInput.length).toBeGreaterThan(0);
  });

  test('submit button', async () => {
    const { $ } = await fetchPage('/forgot-password');
    const button = $('button[type="submit"]');
    expect(button.text()).toContain('Send reset link');
  });

  test('back to login link', async () => {
    const { $ } = await fetchPage('/forgot-password');
    const loginLink = $('a[href="/login"]');
    expect(loginLink.length).toBeGreaterThan(0);
    expect($('body').text()).toContain('Back to login');
  });
});
