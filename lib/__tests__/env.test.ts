import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { _resetEnvCache, validateEnv } from '@/lib/env';

describe('env validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    _resetEnvCache();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_abc123';
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '0x4AAAAAAA_test_site_key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_abc123';
    process.env.RESEND_API_KEY = 're_test_abc123';
    process.env.PLAID_CLIENT_ID = 'test-plaid-client-id';
    process.env.PLAID_SECRET = 'test-plaid-secret';
    process.env.PLAID_ENV = 'sandbox';
    process.env.TWILIO_ACCOUNT_SID = 'ACtest1234567890abcdef1234567890ab';
    process.env.TWILIO_AUTH_TOKEN = 'test-twilio-auth-token';
    process.env.TWILIO_PHONE_NUMBER = '+15551234567';
    process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAA_test_secret_key';
  });

  afterEach(() => {
    _resetEnvCache();
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

describe('env var parity — .env.example must list every schema key', () => {
  /**
   * Parse all env var keys defined in lib/env.ts Zod schemas and any
   * direct process.env references used outside exempt files, then verify
   * they all appear in .env.example. This ensures developers remember to
   * document new env vars so Vercel config stays in sync.
   */
  it('every key in the Zod schemas appears in .env.example', () => {
    const envExamplePath = resolve(__dirname, '../../.env.example');
    const envExampleContent = readFileSync(envExamplePath, 'utf-8');

    // Parse keys from .env.example (lines starting with VAR_NAME=)
    const envExampleKeys = new Set(
      envExampleContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.split('=')[0].trim()),
    );

    // Read lib/env.ts and extract keys from z.object({ ... }) definitions
    const envTsPath = resolve(__dirname, '../env.ts');
    const envTsContent = readFileSync(envTsPath, 'utf-8');

    // Match keys like NEXT_PUBLIC_SUPABASE_URL, DATABASE_URL, etc.
    const schemaKeyRegex = /^\s+([A-Z][A-Z0-9_]+):\s*z\./gm;
    const schemaKeys = Array.from(envTsContent.matchAll(schemaKeyRegex), (m) => m[1]);

    expect(schemaKeys.length).toBeGreaterThan(0);

    const missing = schemaKeys.filter((key) => !envExampleKeys.has(key));

    if (missing.length > 0) {
      throw new Error(
        `These env vars are in lib/env.ts but missing from .env.example:\n${missing.map((k) => `  - ${k}`).join('\n')}`,
      );
    }
  });
});
