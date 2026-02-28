import { describe, expect, test } from 'bun:test';
import { fetchPage } from '../helpers/fetch';

describe('Signup page /signup', () => {
  test('returns 200', async () => {
    const { status } = await fetchPage('/signup');
    expect(status).toBe(200);
  });

  test('heading and subtitle', async () => {
    const { $ } = await fetchPage('/signup');
    expect($('h1').text()).toContain('Create an account');
    expect($('body').text()).toContain('Choose your account type or sign up below');
  });

  test('login link', async () => {
    const { $ } = await fetchPage('/signup');
    const loginLink = $('a[href="/login"]');
    expect(loginLink.length).toBeGreaterThan(0);
    expect($('body').text()).toContain('Log in');
  });
});
