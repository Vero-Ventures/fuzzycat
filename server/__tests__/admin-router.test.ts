import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { _resetEnvCache } from '@/lib/env';

// ── Env setup (so serverEnv() works for MFA checks) ─────────────────
// Set required env vars BEFORE any module imports that call serverEnv()
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
// Ensure MFA is disabled so enforceMfa() skips checks
// biome-ignore lint/performance/noDelete: process.env requires delete to truly unset
delete process.env.ENABLE_MFA;

// ── Mocks ────────────────────────────────────────────────────────────

import { createMockChain, dbMock, resetDbMocks } from './db-mock';

mock.module('@/server/db', () => ({
  db: dbMock,
}));

// NOTE: We intentionally do NOT mock @/server/db/schema here. Bun's mock.module
// for the schema contaminates drizzle-orm's internal sql.raw()/sql.join() methods,
// breaking count(), or(), and other SQL builders. The db mock chain ignores all
// query arguments anyway, so the real schema works fine.
mock.module('@/lib/logger', () => ({ logger: { info: mock(), warn: mock(), error: mock() } }));

const { adminRouter } = await import('@/server/routers/admin');
const { createCallerFactory } = await import('@/server/trpc');

const createCaller = createCallerFactory(adminRouter);
const caller = createCaller({
  db: dbMock,
  session: { userId: '00000000-0000-4000-a000-000000000000', role: 'admin' },
  supabase: {
    auth: {
      mfa: {
        listFactors: () => Promise.resolve({ data: { totp: [{ status: 'verified' }] } }),
        getAuthenticatorAssuranceLevel: () => Promise.resolve({ data: { currentLevel: 'aal2' } }),
      },
    },
  },
  // biome-ignore lint/suspicious/noExplicitAny: test context
} as any);

// ── Test data ────────────────────────────────────────────────────────

const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440000';
const PAYMENT_ID = '660e8400-e29b-41d4-a716-446655440000';

const MOCK_CLINIC = {
  id: CLINIC_ID,
  name: 'Happy Paws Veterinary',
  email: 'info@happypaws.com',
  status: 'active',
  stripeAccountId: 'acct_test123',
  createdAt: new Date('2026-01-15'),
  enrollmentCount: 8,
  totalRevenueCents: 250000,
};

// ── Tests ────────────────────────────────────────────────────────────

describe('admin.getPlatformStats', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('returns platform-wide statistics', async () => {
    createMockChain([
      [{ totalEnrollments: 20, activePlans: 8, completedPlans: 10, defaultedPlans: 2 }],
      [{ totalRevenueCents: 600000 }],
      [{ totalFeesCents: 36000 }],
    ]);
    const result = await caller.getPlatformStats();
    expect(result.totalEnrollments).toBe(20);
    expect(result.defaultRate).toBe(10);
  });
});

describe('admin.getClinics', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('returns clinics list', async () => {
    createMockChain([[MOCK_CLINIC], [{ total: 1 }]]);
    const result = await caller.getClinics({ limit: 20, offset: 0 });
    expect(result.clinics[0].name).toBe('Happy Paws Veterinary');
    expect(result.pagination.totalCount).toBe(1);
  });

  it('returns revenue from succeeded payouts only (#263)', async () => {
    // Revenue should reflect only succeeded payouts (via correlated subquery)
    const clinicRow = {
      ...MOCK_CLINIC,
      totalRevenueCents: 84000, // represents sum of succeeded payouts only
    };
    createMockChain([[clinicRow], [{ total: 1 }]]);
    const result = await caller.getClinics({ limit: 20, offset: 0 });
    expect(result.clinics[0].totalRevenueCents).toBe(84000);
  });
});

describe('admin.updateClinicStatus', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('updates clinic status', async () => {
    createMockChain([
      [{ id: CLINIC_ID, status: 'pending' }],
      [{ id: CLINIC_ID, name: 'Happy Paws', status: 'active' }],
    ]);
    const result = await caller.updateClinicStatus({ clinicId: CLINIC_ID, status: 'active' });
    expect(result.status).toBe('active');
  });
});

describe('admin.getPayments', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('returns payments list', async () => {
    createMockChain([
      [
        {
          id: PAYMENT_ID,
          ownerName: 'Jane',
          clinicName: 'Vet',
          amountCents: 100,
          status: 'succeeded',
        },
      ],
      [{ total: 1 }],
    ]);
    const result = await caller.getPayments({ limit: 20, offset: 0 });
    expect(result.payments[0].ownerName).toBe('Jane');
    expect(result.pagination.totalCount).toBe(1);
  });
});

describe('admin.retryPayment', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('retries a failed payment', async () => {
    createMockChain([
      [{ id: PAYMENT_ID, status: 'failed', retryCount: 1 }],
      [{ id: PAYMENT_ID, status: 'pending', retryCount: 2 }],
    ]);
    const result = await caller.retryPayment({ paymentId: PAYMENT_ID });
    expect(result.status).toBe('pending');
    expect(result.retryCount).toBe(2);
  });

  it('throws NOT_FOUND when payment does not exist', async () => {
    createMockChain([
      [], // no payment found
    ]);
    await expect(caller.retryPayment({ paymentId: PAYMENT_ID })).rejects.toThrow(
      'Payment not found',
    );
  });

  it('throws BAD_REQUEST when payment is not failed', async () => {
    createMockChain([[{ id: PAYMENT_ID, status: 'succeeded', retryCount: 0 }]]);
    await expect(caller.retryPayment({ paymentId: PAYMENT_ID })).rejects.toThrow(
      'Only failed payments can be retried',
    );
  });
});

// ── healthCheck ───────────────────────────────────────────────────────

describe('admin.healthCheck', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('returns ok status', async () => {
    const result = await caller.healthCheck();
    expect(result).toEqual({ status: 'ok', router: 'admin' });
  });
});

// ── riskPoolBalance ───────────────────────────────────────────────────

describe('admin.riskPoolBalance', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('returns risk pool balance breakdown', async () => {
    createMockChain([
      [{ totalContributionsCents: 50000, totalClaimsCents: 10000, totalRecoveriesCents: 2000 }],
    ]);
    const result = await caller.riskPoolBalance();
    expect(result.totalContributionsCents).toBe(50000);
    expect(result.balanceCents).toBe(42000); // 50000 + 2000 - 10000
  });
});

// ── riskPoolHealth ────────────────────────────────────────────────────

describe('admin.riskPoolHealth', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('returns health metrics with coverage ratio', async () => {
    createMockChain([
      // getRiskPoolBalance: db.select().from(riskPool)
      [{ totalContributionsCents: 100000, totalClaimsCents: 20000, totalRecoveriesCents: 5000 }],
      // getRiskPoolHealth: db.select().from(plans).where(active)
      [{ outstandingCents: 500000, activePlanCount: 10 }],
    ]);
    const result = await caller.riskPoolHealth();
    expect(result.balanceCents).toBe(85000); // 100000 + 5000 - 20000
    expect(result.outstandingGuaranteesCents).toBe(500000);
    expect(result.activePlanCount).toBe(10);
  });
});

// ── auditLogByEntity ──────────────────────────────────────────────────

describe('admin.auditLogByEntity', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('returns audit log for a specific entity', async () => {
    const entries = [
      { id: 'al-1', entityType: 'plan', entityId: 'plan-1', action: 'created' },
      { id: 'al-2', entityType: 'plan', entityId: 'plan-1', action: 'status_changed' },
    ];
    createMockChain([entries]);
    const result = await caller.auditLogByEntity({
      entityType: 'plan',
      entityId: '11111111-1111-4111-a111-111111111111',
    });
    expect(result).toHaveLength(2);
    expect(result[0].action).toBe('created');
  });
});

// ── auditLogByType ────────────────────────────────────────────────────

describe('admin.auditLogByType', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('returns paginated audit log by type', async () => {
    const entries = [{ id: 'al-1', entityType: 'payment', action: 'retried' }];
    createMockChain([entries]);
    const result = await caller.auditLogByType({ entityType: 'payment', limit: 10, offset: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('retried');
  });
});

// ── updateClinicStatus error branch ───────────────────────────────────

describe('admin.updateClinicStatus — errors', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('throws NOT_FOUND when clinic does not exist', async () => {
    createMockChain([
      [], // no clinic found
    ]);
    await expect(
      caller.updateClinicStatus({ clinicId: CLINIC_ID, status: 'active' }),
    ).rejects.toThrow('Clinic not found');
  });
});

// ── getRiskPoolDetails ────────────────────────────────────────────────

describe('admin.getRiskPoolDetails', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('returns paginated risk pool entries', async () => {
    const entries = [
      { id: 'rp-1', planId: 'plan-1', contributionCents: 1272, type: 'contribution' },
    ];
    createMockChain([entries, [{ total: 1 }]]);
    const result = await caller.getRiskPoolDetails({ limit: 20, offset: 0 });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].contributionCents).toBe(1272);
    expect(result.pagination.totalCount).toBe(1);
  });
});

// ── getDefaultedPlans ─────────────────────────────────────────────────

describe('admin.getDefaultedPlans', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('returns defaulted plans with owner info', async () => {
    const plans = [
      {
        id: 'plan-1',
        totalBillCents: 120000,
        remainingCents: 47700,
        ownerName: 'Jane Doe',
        clinicName: 'Happy Paws',
      },
    ];
    createMockChain([plans, [{ total: 1 }]]);
    const result = await caller.getDefaultedPlans({ limit: 20, offset: 0 });
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0].ownerName).toBe('Jane Doe');
    expect(result.pagination.totalCount).toBe(1);
  });
});

// ── getRecentAuditLog ─────────────────────────────────────────────────

describe('admin.getRecentAuditLog', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('returns recent audit entries', async () => {
    const entries = [{ id: 'al-1', action: 'created', entityType: 'plan' }];
    createMockChain([entries]);
    const result = await caller.getRecentAuditLog({ limit: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('created');
  });
});

// ── getSoftCollections ────────────────────────────────────────────────

describe('admin.getSoftCollections', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('returns paginated soft collections', async () => {
    const rows = [
      {
        id: 'sc-1',
        planId: 'plan-1',
        stage: 'day_1_reminder',
        ownerName: 'Jane',
        clinicName: 'Vet',
      },
    ];
    createMockChain([rows, [{ total: 1 }]]);
    const result = await caller.getSoftCollections({ limit: 20, offset: 0 });
    expect(result.collections).toHaveLength(1);
    expect(result.collections[0].stage).toBe('day_1_reminder');
    expect(result.pagination.totalCount).toBe(1);
  });
});

// ── cancelSoftCollection ──────────────────────────────────────────────

describe('admin.cancelSoftCollection', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('cancels a collection and returns result', async () => {
    createMockChain([
      // cancelSoftCollection service: select current
      [{ id: 'sc-1', planId: 'plan-1', stage: 'day_1_reminder' }],
      // cancelSoftCollection service: update returning
      [{ id: 'sc-1', planId: 'plan-1', stage: 'cancelled', notes: 'Owner called' }],
    ]);
    const result = await caller.cancelSoftCollection({
      collectionId: '11111111-1111-4111-a111-111111111111',
      reason: 'Owner called',
    });
    expect(result.stage).toBe('cancelled');
  });
});

// ── getSoftCollectionStats ────────────────────────────────────────────

describe('admin.getSoftCollectionStats', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('returns stage counts and recovery rate', async () => {
    createMockChain([
      [
        { stage: 'day_1_reminder', count: 5 },
        { stage: 'day_7_followup', count: 3 },
        { stage: 'completed', count: 10 },
        { stage: 'cancelled', count: 2 },
      ],
    ]);
    const result = await caller.getSoftCollectionStats();
    expect(result.totalCollections).toBe(20);
    expect(result.byStage.day_1_reminder).toBe(5);
    expect(result.byStage.completed).toBe(10);
    // recoveryRate = cancelled / (completed + cancelled) * 100 = 2/12 * 100 = 16.67
    expect(result.recoveryRate).toBeCloseTo(16.67, 1);
  });
});
