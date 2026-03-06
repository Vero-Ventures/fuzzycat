import { describe, expect, test } from 'bun:test';
import { fetchPage } from '../helpers/fetch';

describe('Login page /login', () => {
  test('returns 200', async () => {
    const { status } = await fetchPage('/login');
    expect(status).toBe(200);
  });

  test('heading and subtitle', async () => {
    const { $ } = await fetchPage('/login');
    expect($('h1').text()).toContain('Welcome Back');
    expect($('body').text()).toContain('Sign in to your account');
  });

  test('signup link', async () => {
    const { $ } = await fetchPage('/login');
    const signupLink = $('a[href="/signup"]');
    expect(signupLink.length).toBeGreaterThan(0);
    expect($('body').text()).toContain('Sign up');
  });
});
