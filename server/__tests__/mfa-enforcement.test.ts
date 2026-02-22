import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { _resetEnvCache } from '@/lib/env';

// ── Env setup ────────────────────────────────────────────────────────
_resetEnvCache();
const REQUIRED_ENV_DEFAULTS: Record<string, string> = {
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  DATABASE_URL: 'postgres://test:test@localhost/test',
  STRIPE_SECRET_KEY: 'sk_test_placeholder',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_placeholder',
  RESEND_API_KEY: 're_test_placeholder',
  PLAID_CLIENT_ID: 'test-plaid-client',
  PLAID_SECRET: 'test-plaid-secret',
  PLAID_ENV: 'sandbox',
  TWILIO_ACCOUNT_SID: 'ACtest_placeholder',
  TWILIO_AUTH_TOKEN: 'test-auth-token',
  TWILIO_PHONE_NUMBER: '+15551234567',
};
for (const [key, val] of Object.entries(REQUIRED_ENV_DEFAULTS)) {
  if (!process.env[key]) process.env[key] = val;
}

// ── Mocks ────────────────────────────────────────────────────────────

import { createMockChain, dbMock, resetDbMocks } from './db-mock';

mock.module('@/server/db', () => ({
  db: dbMock,
}));

mock.module('@/server/db/schema', () => ({
  clinics: { id: 'clinics.id', authId: 'clinics.auth_id' },
  owners: { id: 'owners.id', authId: 'owners.auth_id' },
}));

const {
  router,
  createCallerFactory,
  adminProcedure,
  clinicProcedure,
  ownerProcedure,
  protectedProcedure,
} = await import('@/server/trpc');

// ── Test router ──────────────────────────────────────────────────────
// Minimal procedures that return a success marker so we can test middleware.

const testRouter = router({
  adminAction: adminProcedure.query(() => ({ ok: true })),
  clinicAction: clinicProcedure.query(() => ({ ok: true })),
  ownerAction: ownerProcedure.query(() => ({ ok: true })),
  protectedAction: protectedProcedure.query(() => ({ ok: true })),
});

const createCaller = createCallerFactory(testRouter);

// ── Helpers ──────────────────────────────────────────────────────────

const ADMIN_USER_ID = '00000000-0000-4000-a000-000000000001';
const CLINIC_USER_ID = '00000000-0000-4000-a000-000000000002';
const OWNER_USER_ID = '00000000-0000-4000-a000-000000000003';
const CLINIC_ROW_ID = '00000000-0000-4000-a000-000000000010';
const OWNER_ROW_ID = '00000000-0000-4000-a000-000000000020';

function makeMfaMock(opts: { hasVerifiedTotp: boolean; currentLevel: 'aal1' | 'aal2' }) {
  return {
    auth: {
      mfa: {
        listFactors: mock(() =>
          Promise.resolve({
            data: {
              totp: opts.hasVerifiedTotp ? [{ status: 'verified' }] : [],
            },
          }),
        ),
        getAuthenticatorAssuranceLevel: mock(() =>
          Promise.resolve({
            data: { currentLevel: opts.currentLevel },
          }),
        ),
      },
    },
  };
}

function makeContext(
  role: 'admin' | 'clinic' | 'owner',
  supabaseMock: ReturnType<typeof makeMfaMock>,
) {
  const userIdMap = { admin: ADMIN_USER_ID, clinic: CLINIC_USER_ID, owner: OWNER_USER_ID };
  return {
    db: dbMock,
    session: { userId: userIdMap[role], role },
    supabase: supabaseMock,
    requestId: undefined,
    req: new Request('http://localhost:3000/api/trpc'),
    resHeaders: new Headers(),
    // biome-ignore lint/suspicious/noExplicitAny: test context
  } as any;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('MFA enforcement in tRPC procedures', () => {
  beforeEach(() => {
    resetDbMocks();
  });
  afterEach(() => {
    resetDbMocks();
    // biome-ignore lint/performance/noDelete: process.env requires delete to truly unset
    delete process.env.ENABLE_MFA;
    _resetEnvCache();
  });

  describe('when MFA is disabled', () => {
    it('admin procedure passes without MFA checks', async () => {
      const supabaseMock = makeMfaMock({ hasVerifiedTotp: false, currentLevel: 'aal1' });
      const caller = createCaller(makeContext('admin', supabaseMock));
      const result = await caller.adminAction();
      expect(result.ok).toBe(true);
      // MFA methods should NOT have been called
      expect(supabaseMock.auth.mfa.listFactors).not.toHaveBeenCalled();
      expect(supabaseMock.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
    });

    it('clinic procedure passes without MFA checks', async () => {
      // clinicProcedure does a DB lookup for the clinic row
      createMockChain([[{ id: CLINIC_ROW_ID }]]);
      const supabaseMock = makeMfaMock({ hasVerifiedTotp: false, currentLevel: 'aal1' });
      const caller = createCaller(makeContext('clinic', supabaseMock));
      const result = await caller.clinicAction();
      expect(result.ok).toBe(true);
      expect(supabaseMock.auth.mfa.listFactors).not.toHaveBeenCalled();
    });
  });

  describe('when MFA is enabled', () => {
    beforeEach(() => {
      process.env.ENABLE_MFA = 'true';
      _resetEnvCache();
    });

    it('admin with verified TOTP and AAL2 passes', async () => {
      const supabaseMock = makeMfaMock({ hasVerifiedTotp: true, currentLevel: 'aal2' });
      const caller = createCaller(makeContext('admin', supabaseMock));
      const result = await caller.adminAction();
      expect(result.ok).toBe(true);
      expect(supabaseMock.auth.mfa.listFactors).toHaveBeenCalledTimes(1);
      expect(supabaseMock.auth.mfa.getAuthenticatorAssuranceLevel).toHaveBeenCalledTimes(1);
    });

    it('clinic with verified TOTP and AAL2 passes', async () => {
      createMockChain([[{ id: CLINIC_ROW_ID }]]);
      const supabaseMock = makeMfaMock({ hasVerifiedTotp: true, currentLevel: 'aal2' });
      const caller = createCaller(makeContext('clinic', supabaseMock));
      const result = await caller.clinicAction();
      expect(result.ok).toBe(true);
      expect(supabaseMock.auth.mfa.listFactors).toHaveBeenCalledTimes(1);
      expect(supabaseMock.auth.mfa.getAuthenticatorAssuranceLevel).toHaveBeenCalledTimes(1);
    });

    it('admin without verified TOTP throws MFA enrollment required', async () => {
      const supabaseMock = makeMfaMock({ hasVerifiedTotp: false, currentLevel: 'aal1' });
      const caller = createCaller(makeContext('admin', supabaseMock));
      await expect(caller.adminAction()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'MFA enrollment required',
      });
    });

    it('clinic without verified TOTP throws MFA enrollment required', async () => {
      const supabaseMock = makeMfaMock({ hasVerifiedTotp: false, currentLevel: 'aal1' });
      const caller = createCaller(makeContext('clinic', supabaseMock));
      await expect(caller.clinicAction()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'MFA enrollment required',
      });
    });

    it('admin with verified TOTP but AAL1 throws MFA verification required', async () => {
      const supabaseMock = makeMfaMock({ hasVerifiedTotp: true, currentLevel: 'aal1' });
      const caller = createCaller(makeContext('admin', supabaseMock));
      await expect(caller.adminAction()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'MFA verification required',
      });
    });

    it('clinic with verified TOTP but AAL1 throws MFA verification required', async () => {
      const supabaseMock = makeMfaMock({ hasVerifiedTotp: true, currentLevel: 'aal1' });
      const caller = createCaller(makeContext('clinic', supabaseMock));
      await expect(caller.clinicAction()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'MFA verification required',
      });
    });

    it('owner procedure does NOT enforce MFA even when enabled', async () => {
      createMockChain([[{ id: OWNER_ROW_ID }]]);
      const supabaseMock = makeMfaMock({ hasVerifiedTotp: false, currentLevel: 'aal1' });
      const caller = createCaller(makeContext('owner', supabaseMock));
      const result = await caller.ownerAction();
      expect(result.ok).toBe(true);
      // MFA should not be checked for owner role
      expect(supabaseMock.auth.mfa.listFactors).not.toHaveBeenCalled();
    });
  });

  describe('role enforcement (independent of MFA)', () => {
    it('owner cannot access admin procedures', async () => {
      const supabaseMock = makeMfaMock({ hasVerifiedTotp: false, currentLevel: 'aal1' });
      const caller = createCaller(makeContext('owner', supabaseMock));
      await expect(caller.adminAction()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    });

    it('owner cannot access clinic procedures', async () => {
      const supabaseMock = makeMfaMock({ hasVerifiedTotp: false, currentLevel: 'aal1' });
      const caller = createCaller(makeContext('owner', supabaseMock));
      await expect(caller.clinicAction()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    });

    it('clinic cannot access admin procedures', async () => {
      const supabaseMock = makeMfaMock({ hasVerifiedTotp: false, currentLevel: 'aal1' });
      const caller = createCaller(makeContext('clinic', supabaseMock));
      await expect(caller.adminAction()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    });

    it('unauthenticated request throws UNAUTHORIZED', async () => {
      const caller = createCaller({
        db: dbMock,
        session: null,
        supabase: {},
        requestId: undefined,
        req: new Request('http://localhost:3000/api/trpc'),
        resHeaders: new Headers(),
        // biome-ignore lint/suspicious/noExplicitAny: test context
      } as any);
      await expect(caller.adminAction()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    });
  });
});
