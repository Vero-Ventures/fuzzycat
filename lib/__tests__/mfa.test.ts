import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// Mock serverEnv before importing mfa module
let mockEnableMfa: string | undefined;

mock.module('@/lib/env', () => ({
  serverEnv: () => ({
    ENABLE_MFA: mockEnableMfa,
  }),
}));

// Mock next/navigation to capture redirects
const mockRedirect = mock((url: string): never => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
mock.module('next/navigation', () => ({
  redirect: mockRedirect,
}));

const { isMfaEnabled, enforceMfa } = await import('@/lib/supabase/mfa');

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
    mockEnableMfa = undefined;
  });

  it('returns false when ENABLE_MFA is undefined', () => {
    mockEnableMfa = undefined;
    expect(isMfaEnabled()).toBe(false);
  });

  it('returns false when ENABLE_MFA is empty string', () => {
    mockEnableMfa = '';
    expect(isMfaEnabled()).toBe(false);
  });

  it('returns false when ENABLE_MFA is "false"', () => {
    mockEnableMfa = 'false';
    expect(isMfaEnabled()).toBe(false);
  });

  it('returns true when ENABLE_MFA is "true"', () => {
    mockEnableMfa = 'true';
    expect(isMfaEnabled()).toBe(true);
  });
});

describe('enforceMfa', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
  });

  afterEach(() => {
    mockEnableMfa = undefined;
  });

  it('skips all checks when MFA is disabled', async () => {
    mockEnableMfa = undefined;
    const supabase = createMockSupabase({ currentLevel: 'aal1', totpFactors: [] });

    await enforceMfa(supabase);

    // Should not have called any Supabase MFA methods
    expect(supabase.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
    expect(supabase.auth.mfa.listFactors).not.toHaveBeenCalled();
  });

  it('allows access when MFA is enabled and user has AAL2', async () => {
    mockEnableMfa = 'true';
    const supabase = createMockSupabase({ currentLevel: 'aal2' });

    await enforceMfa(supabase);

    expect(supabase.auth.mfa.getAuthenticatorAssuranceLevel).toHaveBeenCalled();
    expect(supabase.auth.mfa.listFactors).not.toHaveBeenCalled();
  });

  it('redirects to /mfa/setup when MFA is enabled and no TOTP factor', async () => {
    mockEnableMfa = 'true';
    const supabase = createMockSupabase({ currentLevel: 'aal1', totpFactors: [] });

    await expect(enforceMfa(supabase)).rejects.toThrow('NEXT_REDIRECT:/mfa/setup');
  });

  it('redirects to /mfa/verify when MFA is enabled and TOTP exists but not AAL2', async () => {
    mockEnableMfa = 'true';
    const supabase = createMockSupabase({
      currentLevel: 'aal1',
      totpFactors: [{ status: 'verified' }],
    });

    await expect(enforceMfa(supabase)).rejects.toThrow('NEXT_REDIRECT:/mfa/verify');
  });
});
