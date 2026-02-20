import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { validateEnv } from '@/lib/env';

describe('env validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_abc123';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc123';
    process.env.RESEND_API_KEY = 're_test_abc123';
    process.env.TWILIO_ACCOUNT_SID = 'ACtest1234567890abcdef1234567890ab';
    process.env.TWILIO_AUTH_TOKEN = 'test-twilio-auth-token';
    process.env.TWILIO_PHONE_NUMBER = '+15551234567';
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it('publicEnv() succeeds with valid env vars', async () => {
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

  it('validateEnv throws when a required var is missing', () => {
    const schema = z.object({
      REQUIRED_VAR: z.string().min(1, 'REQUIRED_VAR is required'),
    });

    expect(() => validateEnv(schema, {})).toThrow('Missing or invalid environment variables');
  });

  it('validateEnv throws when a URL var is not a valid URL', () => {
    const schema = z.object({
      MY_URL: z.string().url('MY_URL must be a valid URL'),
    });

    expect(() => validateEnv(schema, { MY_URL: 'not-a-url' })).toThrow(
      'Missing or invalid environment variables',
    );
  });

  it('validateEnv error message includes the field name', () => {
    const schema = z.object({
      DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    });

    expect(() => validateEnv(schema, {})).toThrow('DATABASE_URL');
  });

  it('validateEnv returns parsed values on success', () => {
    const schema = z.object({
      FOO: z.string(),
      BAR: z.string(),
    });

    const result = validateEnv(schema, { FOO: 'hello', BAR: 'world' });
    expect(result).toEqual({ FOO: 'hello', BAR: 'world' });
  });
});
