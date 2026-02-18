import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

describe('env validation', () => {
  // We test the validation logic directly by importing the module fresh each time.
  // Since env.ts caches results, we need to test the underlying Zod schemas instead.

  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Ensure env vars are set for valid tests
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
  });

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it('publicEnv() succeeds with valid env vars', async () => {
    // Clear cached values by re-importing
    const { publicEnv } = await import('@/lib/env');
    const env = publicEnv();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co');
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('test-anon-key');
  });

  it('serverEnv() succeeds with valid env vars', async () => {
    const { serverEnv } = await import('@/lib/env');
    const env = serverEnv();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('test-service-role-key');
    expect(env.DATABASE_URL).toBe('postgresql://localhost:5432/test');
  });
});
