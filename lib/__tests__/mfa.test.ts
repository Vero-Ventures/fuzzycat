import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// Mock next/navigation to capture redirects
const mockRedirect = mock((url: string): never => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
mock.module('next/navigation', () => ({
  redirect: mockRedirect,
}));

const { isMfaEnabled, enforceMfa } = await import('@/lib/supabase/mfa');

const originalEnableMfa = process.env.ENABLE_MFA;

function setMfaEnv(value: string | undefined) {
  if (value === undefined) {
    process.env.ENABLE_MFA = undefined as unknown as string;
  } else {
    process.env.ENABLE_MFA = value;
  }
}

function createMockSupabase(opts: {
  currentLevel?: 'aal1' | 'aal2';
  totpFactors?: Array<{ status: string }>;
}) {
  return {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: mock(() =>
          Promise.resolve({ data: { currentLevel: opts.currentLevel ?? 'aal1' } }),
        ),
        listFactors: mock(() => Promise.resolve({ data: { totp: opts.totpFactors ?? [] } })),
      },
    },
  } as unknown as Parameters<typeof enforceMfa>[0];
}

describe('isMfaEnabled', () => {
  afterEach(() => {
    setMfaEnv(originalEnableMfa);
  });

  it('returns false when ENABLE_MFA is undefined', () => {
    setMfaEnv(undefined);
    expect(isMfaEnabled()).toBe(false);
  });

  it('returns false when ENABLE_MFA is empty string', () => {
    setMfaEnv('');
    expect(isMfaEnabled()).toBe(false);
  });

  it('returns false when ENABLE_MFA is "false"', () => {
    setMfaEnv('false');
    expect(isMfaEnabled()).toBe(false);
  });

  it('returns true when ENABLE_MFA is "true"', () => {
    setMfaEnv('true');
    expect(isMfaEnabled()).toBe(true);
  });
});

describe('enforceMfa', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
  });

  afterEach(() => {
    setMfaEnv(originalEnableMfa);
  });

  it('skips all checks when MFA is disabled', async () => {
    setMfaEnv(undefined);
    const supabase = createMockSupabase({ currentLevel: 'aal1', totpFactors: [] });

    await enforceMfa(supabase);

    expect(supabase.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
    expect(supabase.auth.mfa.listFactors).not.toHaveBeenCalled();
  });

  it('allows access when MFA is enabled and user has AAL2', async () => {
    setMfaEnv('true');
    const supabase = createMockSupabase({ currentLevel: 'aal2' });

    await enforceMfa(supabase);

    expect(supabase.auth.mfa.getAuthenticatorAssuranceLevel).toHaveBeenCalled();
    expect(supabase.auth.mfa.listFactors).not.toHaveBeenCalled();
  });

  it('redirects to /mfa/setup when MFA is enabled and no TOTP factor', async () => {
    setMfaEnv('true');
    const supabase = createMockSupabase({ currentLevel: 'aal1', totpFactors: [] });

    await expect(enforceMfa(supabase)).rejects.toThrow('NEXT_REDIRECT:/mfa/setup');
  });

  it('redirects to /mfa/verify when MFA is enabled and TOTP exists but not AAL2', async () => {
    setMfaEnv('true');
    const supabase = createMockSupabase({
      currentLevel: 'aal1',
      totpFactors: [{ status: 'verified' }],
    });

    await expect(enforceMfa(supabase)).rejects.toThrow('NEXT_REDIRECT:/mfa/verify');
  });
});
