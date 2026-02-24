import { describe, expect, test } from 'bun:test';
import { fetchPage } from '../helpers/fetch';

describe('Reset password page /reset-password', () => {
  test('returns 200', async () => {
    const { status } = await fetchPage('/reset-password');
    expect(status).toBe(200);
  });

  test('heading', async () => {
    const { $ } = await fetchPage('/reset-password');
    expect($('h1').text()).toContain('Set a new password');
  });

  test('password inputs', async () => {
    const { $ } = await fetchPage('/reset-password');
    const passwordInputs = $('input[type="password"]');
    expect(passwordInputs.length).toBe(2);
  });

  test('submit button', async () => {
    const { $ } = await fetchPage('/reset-password');
    const button = $('button[type="submit"]');
    expect(button.text()).toContain('Update password');
  });
});
