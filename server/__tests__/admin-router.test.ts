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

import { schemaMock } from './stripe/_mock-schema';

const extendedSchemaMock = {
  ...schemaMock,
  clinics: { ...schemaMock.clinics, name: 'clinics.name', createdAt: 'clinics.created_at' },
  plans: { ...schemaMock.plans, status: 'plans.status', feeCents: 'plans.fee_cents' },
  payments: { ...schemaMock.payments, scheduledAt: 'payments.scheduled_at' },
};

mock.module('@/server/db/schema', () => extendedSchemaMock);
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
});
