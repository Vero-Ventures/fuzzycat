import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { TRPCError } from '@trpc/server';
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

import { createMockChain, dbMock, resetDbMocks } from '@/server/__tests__/db-mock';

mock.module('@/server/db', () => ({ db: dbMock }));

// NOTE: We intentionally do NOT mock @/server/db/schema here.
mock.module('@/lib/logger', () => ({ logger: { info: mock(), warn: mock(), error: mock() } }));

mock.module('next/cache', () => ({
  unstable_cache: mock((fn: () => unknown) => fn),
  revalidateTag: mock(),
}));

// Stripe mocks
const mockStripeAccountsRetrieve = mock(() =>
  Promise.resolve({ charges_enabled: true, payouts_enabled: true }),
);
const mockStripeAccountsCreate = mock(() => Promise.resolve({ id: 'acct_new_456' }));
const mockStripeAccountLinksCreate = mock(() =>
  Promise.resolve({ url: 'https://connect.stripe.com/setup/e/test' }),
);

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    accounts: {
      retrieve: mockStripeAccountsRetrieve,
      create: mockStripeAccountsCreate,
    },
    accountLinks: { create: mockStripeAccountLinksCreate },
    transfers: { create: mock(() => Promise.resolve({ id: 'tr_test' })) },
  }),
}));

// NOTE: Do NOT mock @/server/services/email or @/lib/resend here —
// it contaminates email.test.ts and soft-collection.test.ts.
// Our tested procedures don't send emails, so no mock is needed.

// NOTE: Do NOT mock @/lib/supabase/mfa here — it contaminates mfa.test.ts.
// Instead, we disable MFA via process.env.ENABLE_MFA=undefined (above)
// and provide verified TOTP factors in the test context.

// ── Router + caller setup ─────────────────────────────────────────────

const { clinicRouter } = await import('@/server/routers/clinic');
const { createCallerFactory } = await import('@/server/trpc');

const createClinicCaller = createCallerFactory(clinicRouter);

// ── Test data ─────────────────────────────────────────────────────────

const CLINIC_ID = '11111111-1111-4111-a111-111111111111';
const PLAN_ID = '33333333-3333-4333-a333-333333333333';
const USER_ID = 'user-test-clinic';

const MOCK_CLINIC_FULL = {
  id: CLINIC_ID,
  name: 'Happy Paws Veterinary',
  email: 'info@happypaws.com',
  phone: '+15551234567',
  addressLine1: '123 Main St',
  addressCity: 'San Francisco',
  addressState: 'CA',
  addressZip: '94102',
  stripeAccountId: 'acct_test123',
  status: 'pending',
};

// biome-ignore lint/suspicious/noExplicitAny: test context
function ctx(): any {
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

function clearStripeMocks() {
  mockStripeAccountsRetrieve.mockClear();
  mockStripeAccountsCreate.mockClear();
  mockStripeAccountLinksCreate.mockClear();
}

// ── healthCheck ───────────────────────────────────────────────────────

describe('clinic.healthCheck', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('returns ok status', async () => {
    // clinicProcedure middleware: clinic lookup
    createMockChain([[{ id: CLINIC_ID }]]);

    const caller = createClinicCaller(ctx());
    const result = await caller.healthCheck();
    expect(result).toEqual({ status: 'ok', router: 'clinic' });
  });
});

// ── getProfile ────────────────────────────────────────────────────────

describe('clinic.getProfile', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('returns clinic profile', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [MOCK_CLINIC_FULL], // getClinicById query
    ]);

    const caller = createClinicCaller(ctx());
    const result = await caller.getProfile();
    expect(result.name).toBe('Happy Paws Veterinary');
    expect(result.email).toBe('info@happypaws.com');
  });

  it('throws NOT_FOUND when clinic missing', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [], // no clinic
    ]);

    const caller = createClinicCaller(ctx());
    await expect(caller.getProfile()).rejects.toThrow('Clinic profile not found');
  });
});

// ── updateProfile ─────────────────────────────────────────────────────

describe('clinic.updateProfile', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('updates name and returns updated profile', async () => {
    const updated = { ...MOCK_CLINIC_FULL, name: 'New Clinic Name' };
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [MOCK_CLINIC_FULL], // getClinicById select
      [updated], // update returning
    ]);

    const caller = createClinicCaller(ctx());
    const result = await caller.updateProfile({ name: 'New Clinic Name' });
    expect(result.name).toBe('New Clinic Name');
  });

  it('throws BAD_REQUEST when no fields provided', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
    ]);

    const caller = createClinicCaller(ctx());
    await expect(caller.updateProfile({})).rejects.toThrow(TRPCError);
  });
});

// ── getClientStats (#263) ──────────────────────────────────────────────

describe('clinic.getClientStats', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('returns outstanding as plan totals minus succeeded payments', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      // Plan-level aggregates (first query)
      [{ activePlans: '3', activeTotalCents: '300000', totalPlans: '5', defaultedPlans: '1' }],
      // Succeeded payments for active plans (second query)
      [{ paidCents: '120000' }],
    ]);

    const caller = createClinicCaller(ctx());
    const result = await caller.getClientStats();
    expect(result.activePlans).toBe(3);
    // Outstanding = 300000 - 120000 = 180000
    expect(result.totalOutstandingCents).toBe(180000);
    expect(result.defaultRate).toBe(20); // 1/5 * 100
  });

  it('returns zero outstanding when no active plans', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [{ activePlans: '0', activeTotalCents: '0', totalPlans: '2', defaultedPlans: '0' }],
      [{ paidCents: '0' }],
    ]);

    const caller = createClinicCaller(ctx());
    const result = await caller.getClientStats();
    expect(result.activePlans).toBe(0);
    expect(result.totalOutstandingCents).toBe(0);
    expect(result.defaultRate).toBe(0);
  });

  it('clamps outstanding to zero when overpaid', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [{ activePlans: '1', activeTotalCents: '50000', totalPlans: '1', defaultedPlans: '0' }],
      [{ paidCents: '60000' }], // somehow overpaid
    ]);

    const caller = createClinicCaller(ctx());
    const result = await caller.getClientStats();
    expect(result.totalOutstandingCents).toBe(0);
  });
});

// ── getDashboardStats ─────────────────────────────────────────────────

describe('clinic.getDashboardStats', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('returns dashboard statistics', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [{ activePlans: '5', completedPlans: '3', defaultedPlans: '1', totalPlans: '10' }],
      [{ totalRevenueCents: '15000', totalPayoutCents: '500000' }],
      [{ pendingCount: '2', pendingAmountCents: '30000' }],
      [{ id: 'plan-1', ownerName: 'Jane', petName: 'Whiskers', totalBillCents: 120000 }],
    ]);

    const caller = createClinicCaller(ctx());
    const result = await caller.getDashboardStats();
    expect(result.activePlans).toBe(5);
    expect(result.totalPlans).toBe(10);
    expect(result.totalRevenueCents).toBe(15000);
  });
});

// ── getClients ────────────────────────────────────────────────────────

describe('clinic.getClients', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('returns paginated client list', async () => {
    const clientRow = {
      planId: PLAN_ID,
      ownerName: 'Jane Doe',
      ownerEmail: 'jane@example.com',
      petName: 'Whiskers',
      totalBillCents: 120000,
      planStatus: 'active',
      totalPaidCents: '47700',
    };

    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [clientRow], // clients query
      [{ total: 1 }], // count query
    ]);

    const caller = createClinicCaller(ctx());
    const result = await caller.getClients({ page: 1, pageSize: 20 });
    expect(result.clients).toHaveLength(1);
    expect(result.clients[0].ownerName).toBe('Jane Doe');
    expect(result.pagination.totalCount).toBe(1);
  });

  it('returns empty when no clients', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [], // no clients
      [{ total: 0 }],
    ]);

    const caller = createClinicCaller(ctx());
    const result = await caller.getClients({ page: 1, pageSize: 20 });
    expect(result.clients).toEqual([]);
    expect(result.pagination.totalCount).toBe(0);
  });
});

// ── getClientDetails ─────────────────────────────────────────────────

describe('clinic.getClientDetails', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  const OWNER_ID = '22222222-2222-4222-a222-222222222222';
  const PLAN_ID_2 = '44444444-4444-4444-a444-444444444444';
  const PLAN_ID_3 = '55555555-5555-4555-a555-555555555555';

  it('returns all plans for a client at this clinic', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [{ ownerId: OWNER_ID }], // seed plan lookup
      [
        {
          id: OWNER_ID,
          name: 'Alice Johnson',
          email: 'alice@example.com',
          phone: '+15559999999',
          petName: 'Buddy',
        },
      ], // owner lookup
      [
        {
          id: PLAN_ID,
          totalBillCents: 500000,
          totalWithFeeCents: 530000,
          depositCents: 132500,
          installmentCents: 66250,
          numInstallments: 6,
          status: 'active',
          createdAt: new Date('2025-12-01'),
          petName: 'Buddy',
          totalPaidCents: '132500',
        },
        {
          id: PLAN_ID_2,
          totalBillCents: 120000,
          totalWithFeeCents: 127200,
          depositCents: 31800,
          installmentCents: 15900,
          numInstallments: 6,
          status: 'active',
          createdAt: new Date('2026-01-15'),
          petName: 'Buddy',
          totalPaidCents: '47700',
        },
        {
          id: PLAN_ID_3,
          totalBillCents: 250000,
          totalWithFeeCents: 265000,
          depositCents: 66250,
          installmentCents: 33125,
          numInstallments: 6,
          status: 'completed',
          createdAt: new Date('2025-06-01'),
          petName: 'Mittens',
          totalPaidCents: '265000',
        },
      ], // all plans for this owner at this clinic
    ]);

    const caller = createClinicCaller(ctx());
    const result = await caller.getClientDetails({ planId: PLAN_ID });

    // Should return owner info
    expect(result.owner.name).toBe('Alice Johnson');
    expect(result.owner.email).toBe('alice@example.com');

    // Should return ALL 3 plans
    expect(result.plans).toHaveLength(3);
    expect(result.plans[0].id).toBe(PLAN_ID);
    expect(result.plans[1].id).toBe(PLAN_ID_2);
    expect(result.plans[2].id).toBe(PLAN_ID_3);

    // Should correctly parse totalPaidCents as numbers
    expect(result.plans[0].totalPaidCents).toBe(132500);
    expect(result.plans[1].totalPaidCents).toBe(47700);
    expect(result.plans[2].totalPaidCents).toBe(265000);
  });

  it('throws NOT_FOUND when plan does not exist', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [], // no plan
    ]);

    const caller = createClinicCaller(ctx());
    await expect(caller.getClientDetails({ planId: PLAN_ID })).rejects.toThrow('not found');
  });

  it('throws NOT_FOUND when plan has no owner', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [{ ownerId: null }], // plan with no owner
    ]);

    const caller = createClinicCaller(ctx());
    await expect(caller.getClientDetails({ planId: PLAN_ID })).rejects.toThrow('not found');
  });

  it('throws NOT_FOUND when owner record is missing', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [{ ownerId: OWNER_ID }], // seed plan lookup
      [], // no owner found
    ]);

    const caller = createClinicCaller(ctx());
    await expect(caller.getClientDetails({ planId: PLAN_ID })).rejects.toThrow('not found');
  });

  it('returns clientSince as earliest plan date', async () => {
    const earlyDate = new Date('2025-01-01');
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [{ ownerId: OWNER_ID }], // seed plan lookup
      [
        {
          id: OWNER_ID,
          name: 'Bob',
          email: 'bob@example.com',
          phone: '+15551111111',
          petName: 'Rex',
        },
      ], // owner
      [
        {
          id: PLAN_ID,
          totalBillCents: 100000,
          totalWithFeeCents: 106000,
          depositCents: 26500,
          installmentCents: 13250,
          numInstallments: 6,
          status: 'active',
          createdAt: earlyDate,
          petName: 'Rex',
          totalPaidCents: '26500',
        },
      ], // single plan (earliest = itself)
    ]);

    const caller = createClinicCaller(ctx());
    const result = await caller.getClientDetails({ planId: PLAN_ID });
    expect(result.plans).toHaveLength(1);
    expect(result.clientSince).toEqual(earlyDate);
  });
});

// ── getClientPlanDetails ──────────────────────────────────────────────

describe('clinic.getClientPlanDetails', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('returns plan details with payments and payouts', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [
        {
          id: PLAN_ID,
          totalBillCents: 120000,
          ownerName: 'Jane Doe',
          petName: 'Whiskers',
          status: 'active',
        },
      ], // plan query
      [{ id: 'pay-1', type: 'deposit', amountCents: 31800, status: 'succeeded' }], // payments
      [{ id: 'payout-1', amountCents: 30000, clinicShareCents: 954, status: 'succeeded' }], // payouts
    ]);

    const caller = createClinicCaller(ctx());
    const result = await caller.getClientPlanDetails({ planId: PLAN_ID });
    expect(result.plan.totalBillCents).toBe(120000);
    expect(result.payments).toHaveLength(1);
    expect(result.payouts).toHaveLength(1);
  });

  it('throws NOT_FOUND when plan does not exist', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [], // no plan
    ]);

    const caller = createClinicCaller(ctx());
    await expect(caller.getClientPlanDetails({ planId: PLAN_ID })).rejects.toThrow('not found');
  });
});

// ── getMonthlyRevenue ─────────────────────────────────────────────────

describe('clinic.getMonthlyRevenue', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('returns monthly revenue aggregations', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [
        {
          month: '2026-01',
          totalPayoutCents: '250000',
          totalShareCents: '7500',
          payoutCount: '10',
        },
        {
          month: '2026-02',
          totalPayoutCents: '350000',
          totalShareCents: '10500',
          payoutCount: '14',
        },
      ],
    ]);

    const caller = createClinicCaller(ctx());
    const result = await caller.getMonthlyRevenue();
    expect(result).toHaveLength(2);
    expect(result[0].month).toBe('2026-01');
  });
});

// ── getOnboardingStatus ───────────────────────────────────────────────

describe('clinic.getOnboardingStatus', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('returns complete status when all steps done', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [MOCK_CLINIC_FULL], // getClinicById
    ]);

    mockStripeAccountsRetrieve.mockResolvedValue({
      charges_enabled: true,
      payouts_enabled: true,
    });

    const caller = createClinicCaller(ctx());
    const result = await caller.getOnboardingStatus();
    expect(result.profileComplete).toBe(true);
    expect(result.stripe.status).toBe('active');
  });

  it('returns not_started when no Stripe account', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [{ ...MOCK_CLINIC_FULL, stripeAccountId: null }], // no Stripe
    ]);

    const caller = createClinicCaller(ctx());
    const result = await caller.getOnboardingStatus();
    expect(result.stripe.status).toBe('not_started');
  });
});

// ── getDefaultRate ────────────────────────────────────────────────────

describe('clinic.getDefaultRate', () => {
  beforeEach(() => {
    resetDbMocks();
    clearStripeMocks();
  });
  afterEach(resetDbMocks);

  it('calculates default rate', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [{ totalPlans: '10', defaultedPlans: '2' }],
    ]);

    const caller = createClinicCaller(ctx());
    const result = await caller.getDefaultRate();
    expect(result.defaultRate).toBe(20); // 2/10 * 100
    expect(result.totalPlans).toBe(10);
  });

  it('returns zero rate when no plans', async () => {
    createMockChain([
      [{ id: CLINIC_ID }], // middleware
      [{ totalPlans: '0', defaultedPlans: '0' }],
    ]);

    const caller = createClinicCaller(ctx());
    const result = await caller.getDefaultRate();
    expect(result.defaultRate).toBe(0);
  });
});
