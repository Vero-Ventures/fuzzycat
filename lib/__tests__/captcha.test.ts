import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { verifyCaptcha } from '@/lib/captcha';
import { _resetEnvCache } from '@/lib/env';

describe('verifyCaptcha', () => {
  const originalEnv = process.env.TURNSTILE_SECRET_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    _resetEnvCache();
    process.env.TURNSTILE_SECRET_KEY = 'test-secret-key';
  });

  afterEach(() => {
    process.env.TURNSTILE_SECRET_KEY = originalEnv;
    _resetEnvCache();
    globalThis.fetch = originalFetch;
    mock.restore();
  });

  it('returns true when Turnstile API responds with success', async () => {
    const mockFn = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    globalThis.fetch = mockFn as unknown as typeof fetch;

    const result = await verifyCaptcha('valid-token');
    expect(result).toBe(true);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('returns false when Turnstile API responds with failure', async () => {
    const mockFn = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    globalThis.fetch = mockFn as unknown as typeof fetch;

    const result = await verifyCaptcha('invalid-token');
    expect(result).toBe(false);
  });

  it('returns false when fetch throws a network error', async () => {
    const mockFn = mock(() => Promise.reject(new Error('Network failure')));
    globalThis.fetch = mockFn as unknown as typeof fetch;

    const result = await verifyCaptcha('some-token');
    expect(result).toBe(false);
  });

  it('returns false when HTTP status is not ok', async () => {
    const mockFn = mock(() =>
      Promise.resolve(new Response('Internal Server Error', { status: 500 })),
    );
    globalThis.fetch = mockFn as unknown as typeof fetch;

    const result = await verifyCaptcha('some-token');
    expect(result).toBe(false);
  });

  it('returns false when token is empty', async () => {
    const result = await verifyCaptcha('');
    expect(result).toBe(false);
  });

  it('returns false when TURNSTILE_SECRET_KEY is not set', async () => {
    process.env.TURNSTILE_SECRET_KEY = '';

    const result = await verifyCaptcha('some-token');
    expect(result).toBe(false);
  });

  it('sends correct payload to Turnstile API', async () => {
    let capturedBody = '';
    const mockFn = mock((_url: string, options: RequestInit) => {
      capturedBody = options.body as string;
      return Promise.resolve(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    globalThis.fetch = mockFn as unknown as typeof fetch;

    await verifyCaptcha('my-token');

    const parsed = JSON.parse(capturedBody);
    expect(parsed.secret).toBe('test-secret-key');
    expect(parsed.response).toBe('my-token');
    expect(mockFn.mock.calls[0][0]).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    );
  });
});
