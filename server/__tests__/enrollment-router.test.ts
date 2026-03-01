import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { _resetEnvCache } from '@/lib/env';

// ── Env setup ─────────────────────────────────────────────────────────
_resetEnvCache();
for (const [key, val] of Object.entries({
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
} as Record<string, string>)) {
  if (!process.env[key]) process.env[key] = val;
}
// biome-ignore lint/performance/noDelete: process.env requires delete to truly unset
delete process.env.ENABLE_MFA;

// ── Mocks ─────────────────────────────────────────────────────────────

import { createMockChain, dbMock, resetDbMocks } from './db-mock';

mock.module('@/server/db', () => ({ db: dbMock }));

// NOTE: We intentionally do NOT mock @/server/db/schema here.
mock.module('@/lib/logger', () => ({ logger: { info: mock(), warn: mock(), error: mock() } }));

// Service mocks — router tests verify input validation, authorization,
// and error wrapping, not business logic.
const mockCreateEnrollment = mock(() =>
  Promise.resolve({
    planId: 'plan-1',
    ownerId: 'owner-1',
    depositCents: 31800,
    installmentCents: 15900,
  }),
);
const mockGetEnrollmentSummary = mock(() =>
  Promise.resolve({
    plan: { id: 'plan-1', status: 'pending' },
    owner: { name: 'Jane Doe' },
    clinic: { name: 'Happy Paws' },
    payments: [],
  }),
);
const mockCancelEnrollment = mock(() => Promise.resolve());

mock.module('@/server/services/enrollment', () => ({
  createEnrollment: mockCreateEnrollment,
  getEnrollmentSummary: mockGetEnrollmentSummary,
  cancelEnrollment: mockCancelEnrollment,
}));

const mockAssertClinicOwnership = mock(() => Promise.resolve());
const mockAssertPlanAccess = mock(() => Promise.resolve());

mock.module('@/server/services/authorization', () => ({
  assertClinicOwnership: mockAssertClinicOwnership,
  assertPlanAccess: mockAssertPlanAccess,
}));

// ── Router + caller setup ─────────────────────────────────────────────

const { enrollmentRouter } = await import('@/server/routers/enrollment');
const { createCallerFactory } = await import('@/server/trpc');

const createCaller = createCallerFactory(enrollmentRouter);

// ── Test data ─────────────────────────────────────────────────────────

const CLINIC_ID = '11111111-1111-4111-a111-111111111111';
const PLAN_ID = '33333333-3333-4333-a333-333333333333';
const USER_ID = 'user-test-enrollment';

const VALID_OWNER_DATA = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+15551234567',
  petName: 'Fluffy',
  paymentMethod: 'debit_card' as const,
};

// biome-ignore lint/suspicious/noExplicitAny: test context
function clinicCtx(): any {
  return {
    db: dbMock,
    session: { userId: USER_ID, role: 'clinic' },
    supabase: {
      auth: {
        mfa: {
          listFactors: () => Promise.resolve({ data: { totp: [{ status: 'verified' }] } }),
          getAuthenticatorAssuranceLevel: () => Promise.resolve({ data: { currentLevel: 'aal2' } }),
        },
      },
    },
  };
}

// biome-ignore lint/suspicious/noExplicitAny: test context
function ownerCtx(): any {
  return {
    db: dbMock,
    session: { userId: USER_ID, role: 'owner' },
    supabase: {
      auth: {
        mfa: {
          listFactors: () => Promise.resolve({ data: { totp: [] } }),
          getAuthenticatorAssuranceLevel: () => Promise.resolve({ data: { currentLevel: 'aal1' } }),
        },
      },
    },
  };
}

// biome-ignore lint/suspicious/noExplicitAny: test context
function adminCtx(): any {
  return {
    db: dbMock,
    session: { userId: USER_ID, role: 'admin' },
    supabase: {
      auth: {
        mfa: {
          listFactors: () => Promise.resolve({ data: { totp: [{ status: 'verified' }] } }),
          getAuthenticatorAssuranceLevel: () => Promise.resolve({ data: { currentLevel: 'aal2' } }),
        },
      },
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('enrollment.create', () => {
  beforeEach(() => {
    resetDbMocks();
    mockCreateEnrollment.mockClear();
    mockAssertClinicOwnership.mockClear();
  });
  afterEach(resetDbMocks);

  it('creates enrollment successfully as clinic user', async () => {
    // clinicProcedure looks up clinic by authId
    createMockChain([[{ id: CLINIC_ID }]]);

    const caller = createCaller(clinicCtx());
    const result = await caller.create({
      clinicId: CLINIC_ID,
      ownerData: VALID_OWNER_DATA,
      billAmountCents: 120_000,
    });

    expect(result.planId).toBe('plan-1');
    expect(mockCreateEnrollment).toHaveBeenCalledTimes(1);
    expect(mockAssertClinicOwnership).toHaveBeenCalledWith(USER_ID, CLINIC_ID);
  });

  it('rejects bill below $500 minimum', async () => {
    createMockChain([[{ id: CLINIC_ID }]]);
    const caller = createCaller(clinicCtx());

    await expect(
      caller.create({
        clinicId: CLINIC_ID,
        ownerData: VALID_OWNER_DATA,
        billAmountCents: 49_900, // $499
      }),
    ).rejects.toThrow();
    expect(mockCreateEnrollment).not.toHaveBeenCalled();
  });

  it('rejects bill above $25,000 maximum', async () => {
    createMockChain([[{ id: CLINIC_ID }]]);
    const caller = createCaller(clinicCtx());

    await expect(
      caller.create({
        clinicId: CLINIC_ID,
        ownerData: VALID_OWNER_DATA,
        billAmountCents: 2_500_001, // $25,000.01
      }),
    ).rejects.toThrow();
    expect(mockCreateEnrollment).not.toHaveBeenCalled();
  });

  it('rejects invalid ownerData (missing email)', async () => {
    createMockChain([[{ id: CLINIC_ID }]]);
    const caller = createCaller(clinicCtx());

    await expect(
      caller.create({
        clinicId: CLINIC_ID,
        ownerData: { ...VALID_OWNER_DATA, email: '' },
        billAmountCents: 120_000,
      }),
    ).rejects.toThrow();
    expect(mockCreateEnrollment).not.toHaveBeenCalled();
  });

  it('admin bypasses clinic ownership check', async () => {
    // Admin context — clinicProcedure still looks up clinic but allows null
    createMockChain([[]]);
    const caller = createCaller(adminCtx());

    await caller.create({
      clinicId: CLINIC_ID,
      ownerData: VALID_OWNER_DATA,
      billAmountCents: 120_000,
    });

    expect(mockAssertClinicOwnership).not.toHaveBeenCalled();
    expect(mockCreateEnrollment).toHaveBeenCalledTimes(1);
  });

  it('wraps service error as BAD_REQUEST', async () => {
    createMockChain([[{ id: CLINIC_ID }]]);
    mockCreateEnrollment.mockRejectedValueOnce(new Error('Clinic is not active'));

    const caller = createCaller(clinicCtx());

    await expect(
      caller.create({
        clinicId: CLINIC_ID,
        ownerData: VALID_OWNER_DATA,
        billAmountCents: 120_000,
      }),
    ).rejects.toThrow('Clinic is not active');
  });
});

describe('enrollment.getSummary', () => {
  beforeEach(() => {
    resetDbMocks();
    mockGetEnrollmentSummary.mockClear();
    mockAssertPlanAccess.mockClear();
  });
  afterEach(resetDbMocks);

  it('returns summary for authorized user', async () => {
    const caller = createCaller(ownerCtx());
    // ownerProcedure looks up owner by authId
    createMockChain([[{ id: 'owner-1' }]]);

    const result = await caller.getSummary({ planId: PLAN_ID });

    expect(result.plan.id).toBe('plan-1');
    expect(mockAssertPlanAccess).toHaveBeenCalledWith(USER_ID, 'owner', PLAN_ID);
    expect(mockGetEnrollmentSummary).toHaveBeenCalledWith(PLAN_ID);
  });

  it('rejects invalid planId format', async () => {
    const caller = createCaller(ownerCtx());
    createMockChain([[{ id: 'owner-1' }]]);

    await expect(caller.getSummary({ planId: 'not-a-uuid' })).rejects.toThrow();
    expect(mockGetEnrollmentSummary).not.toHaveBeenCalled();
  });

  it('wraps service error as NOT_FOUND', async () => {
    createMockChain([[{ id: 'owner-1' }]]);
    mockGetEnrollmentSummary.mockRejectedValueOnce(new Error('Plan not found'));

    const caller = createCaller(ownerCtx());

    await expect(caller.getSummary({ planId: PLAN_ID })).rejects.toThrow('Plan not found');
  });
});

describe('enrollment.cancel', () => {
  beforeEach(() => {
    resetDbMocks();
    mockCancelEnrollment.mockClear();
    mockAssertPlanAccess.mockClear();
  });
  afterEach(resetDbMocks);

  it('cancels enrollment for authorized user', async () => {
    createMockChain([[{ id: 'owner-1' }]]);
    const caller = createCaller(ownerCtx());

    const result = await caller.cancel({ planId: PLAN_ID });

    expect(result).toEqual({ success: true });
    expect(mockAssertPlanAccess).toHaveBeenCalledWith(USER_ID, 'owner', PLAN_ID);
    expect(mockCancelEnrollment).toHaveBeenCalledWith(PLAN_ID, USER_ID, 'owner');
  });

  it('wraps service error as BAD_REQUEST', async () => {
    createMockChain([[{ id: 'owner-1' }]]);
    mockCancelEnrollment.mockRejectedValueOnce(new Error('Plan is already active'));

    const caller = createCaller(ownerCtx());

    await expect(caller.cancel({ planId: PLAN_ID })).rejects.toThrow('Plan is already active');
  });

  it('rejects unauthenticated user', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test context
    const caller = createCaller({ db: dbMock, session: null, supabase: {} } as any);

    await expect(caller.cancel({ planId: PLAN_ID })).rejects.toThrow('Not authenticated');
  });
});
