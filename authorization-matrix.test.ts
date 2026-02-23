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
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_placeholder',
};
for (const [key, val] of Object.entries(REQUIRED_ENV_DEFAULTS)) {
  if (!process.env[key]) process.env[key] = val;
}
// biome-ignore lint/performance/noDelete: process.env requires delete to truly unset
delete process.env.ENABLE_MFA;
_resetEnvCache();

// ── DB Mock ──────────────────────────────────────────────────────────

import { schemaMock } from './server/__tests__/stripe/_mock-schema';

const mockSelectResult = mock();
// biome-ignore lint/suspicious/noExplicitAny: test mock
const chainObj: any = {};
chainObj.from = () => chainObj;
chainObj.where = () => chainObj;
chainObj.limit = () => chainObj;
chainObj.offset = () => chainObj;
chainObj.orderBy = () => chainObj;
chainObj.groupBy = () => chainObj;
chainObj.innerJoin = () => chainObj;
chainObj.leftJoin = () => chainObj;
chainObj.returning = () => chainObj;
chainObj.set = () => chainObj;
chainObj.values = () => chainObj;
// biome-ignore lint/suspicious/noThenProperty: drizzle query chain
chainObj.then = (
  // biome-ignore lint/suspicious/noExplicitAny: test mock
  resolve: any,
) => resolve(mockSelectResult());

const mockInsertReturning = mock(() => Promise.resolve([]));

// biome-ignore lint/suspicious/noExplicitAny: test mock
const dbMock: any = {
  select: () => chainObj,
  update: () => chainObj,
  delete: () => chainObj,
  insert: () => ({
    values: () => ({
      returning: mockInsertReturning,
      // biome-ignore lint/suspicious/noThenProperty: drizzle query chain
      then: (
        // biome-ignore lint/suspicious/noExplicitAny: test mock
        resolve: any,
      ) => resolve([]),
    }),
  }),
  transaction: mock(
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    async (fn: any) => fn(dbMock),
  ),
};

// ── Module Mocks ─────────────────────────────────────────────────────

mock.module('@/server/db', () => ({ db: dbMock }));

const fullSchemaMock = {
  ...schemaMock,
  clinics: {
    ...schemaMock.clinics,
    authId: 'clinics.auth_id',
    name: 'clinics.name',
    email: 'clinics.email',
    phone: 'clinics.phone',
    status: 'clinics.status',
    stripeAccountId: 'clinics.stripe_account_id',
    createdAt: 'clinics.created_at',
    addressLine1: 'clinics.address_line1',
    addressCity: 'clinics.address_city',
    addressState: 'clinics.address_state',
    addressZip: 'clinics.address_zip',
  },
  owners: {
    ...schemaMock.owners,
    authId: 'owners.auth_id',
    name: 'owners.name',
    email: 'owners.email',
    phone: 'owners.phone',
    paymentMethod: 'owners.payment_method',
    petName: 'owners.pet_name',
  },
  plans: {
    ...schemaMock.plans,
    clinicId: 'plans.clinic_id',
    ownerId: 'plans.owner_id',
    totalBillCents: 'plans.total_bill_cents',
    feeCents: 'plans.fee_cents',
    depositCents: 'plans.deposit_cents',
    installmentCents: 'plans.installment_cents',
    depositPaidAt: 'plans.deposit_paid_at',
    completedAt: 'plans.completed_at',
    nextPaymentAt: 'plans.next_payment_at',
    createdAt: 'plans.created_at',
  },
  payments: {
    ...schemaMock.payments,
    planId: 'payments.plan_id',
    amountCents: 'payments.amount_cents',
    status: 'payments.status',
    type: 'payments.type',
    sequenceNum: 'payments.sequence_num',
    scheduledAt: 'payments.scheduled_at',
    processedAt: 'payments.processed_at',
    retryCount: 'payments.retry_count',
    createdAt: 'payments.created_at',
  },
  payouts: {
    ...schemaMock.payouts,
    clinicId: 'payouts.clinic_id',
    planId: 'payouts.plan_id',
    paymentId: 'payouts.payment_id',
    amountCents: 'payouts.amount_cents',
    clinicShareCents: 'payouts.clinic_share_cents',
    stripeTransferId: 'payouts.stripe_transfer_id',
    status: 'payouts.status',
    createdAt: 'payouts.created_at',
  },
};

mock.module('@/server/db/schema', () => fullSchemaMock);
mock.module('@/lib/logger', () => ({
  logger: { info: mock(), warn: mock(), error: mock() },
  withRequestId: () => ({ info: mock(), warn: mock(), error: mock() }),
}));
mock.module('@/lib/stripe', () => ({
  stripe: {
    accounts: { create: mock(), createLoginLink: mock() },
    accountLinks: { create: mock() },
    checkout: { sessions: { create: mock() } },
  },
}));
mock.module('@/server/services/authorization', () => ({
  assertClinicOwnership: mock(),
  assertPlanAccess: mock(() => Promise.resolve({ clinicId: 'c1', ownerId: 'o1' })),
  assertPlanOwnership: mock(),
}));
mock.module('@/server/services/enrollment', () => ({
  createEnrollment: mock(),
  cancelEnrollment: mock(),
  getEnrollmentSummary: mock(),
}));
mock.module('@/server/services/payment', () => ({
  processDeposit: mock(),
  processInstallment: mock(),
  handlePaymentSuccess: mock(),
  triggerPayout: mock(),
  handlePaymentFailure: mock(),
  findPaymentByStripeId: mock(),
}));
mock.module('@/server/services/plaid', () => ({
  createLinkToken: mock(),
  exchangePublicToken: mock(),
  checkBalance: mock(),
}));
mock.module('@/server/services/guarantee', () => ({
  calculateContribution: mock(),
  contributeToReserve: mock(),
  getRiskPoolBalance: mock(() => Promise.resolve(0)),
  getRiskPoolHealth: mock(() => Promise.resolve({ balance: 0, target: 0, ratio: 0 })),
}));
mock.module('@/server/services/soft-collection', () => ({
  initiateSoftCollection: mock(),
  escalateSoftCollection: mock(),
  cancelSoftCollection: mock(),
  identifyPendingEscalations: mock(),
  getSoftCollectionByPlan: mock(),
}));
mock.module('@/server/services/audit', () => ({
  AUDIT_ENTITY_TYPES: ['plan', 'payment', 'payout', 'risk_pool', 'clinic', 'owner'],
  AUDIT_ACTIONS: [
    'created',
    'status_changed',
    'retried',
    'defaulted',
    'claimed',
    'contributed',
    'recovered',
    'contribution',
    'payout_initiated',
    'claim_created',
    'payments_written_off',
  ],
  logAuditEvent: mock(),
  getAuditLogByEntity: mock(() => Promise.resolve([])),
  getAuditLogByType: mock(() => Promise.resolve([])),
}));
mock.module('@/server/services/email', () => ({
  sendEnrollmentConfirmation: mock(),
  sendPaymentReminder: mock(),
  sendPaymentSuccess: mock(),
  sendPaymentFailed: mock(),
  sendPlanCompleted: mock(),
  sendClinicWelcome: mock(),
  sendClinicPayoutNotification: mock(),
  sendSoftCollectionDay1: mock(),
  sendSoftCollectionDay7: mock(),
  sendSoftCollectionDay14: mock(),
}));
mock.module('@/server/services/stripe/connect', () => ({
  createConnectAccount: mock(),
  createOnboardingLink: mock(),
  transferToClinic: mock(),
}));
mock.module('@/server/services/stripe/ach', () => ({
  createInstallmentPaymentIntent: mock(),
}));
mock.module('@/server/services/stripe/checkout', () => ({
  createDepositCheckoutSession: mock(),
}));
mock.module('@/server/services/stripe/customer', () => ({
  getOrCreateCustomer: mock(),
}));
mock.module('@/server/services/collection', () => ({
  identifyDuePayments: mock(() => Promise.resolve([])),
  retryFailedPayment: mock(),
  escalateDefault: mock(),
  identifyPlansForEscalation: mock(() => Promise.resolve([])),
  getRetrySuccessRate: mock(() => Promise.resolve({ rate: 0, total: 0, succeeded: 0 })),
}));
mock.module('@/server/services/payout', () => ({
  calculatePayoutBreakdown: mock(),
  processClinicPayout: mock(),
  processPendingPayouts: mock(),
  getClinicPayoutHistory: mock(() => Promise.resolve([])),
  getClinicEarnings: mock(() =>
    Promise.resolve({ totalEarnings: 0, pendingPayouts: 0, completedPayouts: 0 }),
  ),
}));
mock.module('@/server/services/sms', () => ({
  sendPaymentReminder: mock(),
  sendPaymentFailed: mock(),
  sendPaymentFailedWithUrgency: mock(),
  sendDefaultWarning: mock(),
  sendPaymentSuccess: mock(),
  sendSoftCollectionReminder: mock(),
  sendSms: mock(),
  recordOptOut: mock(),
  recordOptIn: mock(),
  isOptedOut: mock(),
  _resetSmsState: mock(),
}));

// ── Import router and factory ────────────────────────────────────────

const { appRouter } = await import('@/server/routers/index');
const { createCallerFactory } = await import('@/server/trpc');

const createCaller = createCallerFactory(appRouter);

// ── Test data ────────────────────────────────────────────────────────

const ADMIN_ID = '00000000-0000-4000-a000-000000000001';
const CLINIC_USER_ID = '00000000-0000-4000-a000-000000000002';
const OWNER_USER_ID = '00000000-0000-4000-a000-000000000003';
const CLINIC_ROW_ID = '00000000-0000-4000-a000-000000000010';
const OWNER_ROW_ID = '00000000-0000-4000-a000-000000000020';

function makeMfaMock() {
  return {
    auth: {
      mfa: {
        listFactors: () => Promise.resolve({ data: { totp: [{ status: 'verified' }] } }),
        getAuthenticatorAssuranceLevel: () => Promise.resolve({ data: { currentLevel: 'aal2' } }),
      },
    },
  };
}

// biome-ignore lint/suspicious/noExplicitAny: test context
function makeCtx(session: { userId: string; role: string } | null): any {
  return {
    db: dbMock,
    session,
    supabase: makeMfaMock(),
    requestId: undefined,
    req: new Request('http://localhost:3000/api/trpc'),
    resHeaders: new Headers(),
  };
}

const unauthCtx = makeCtx(null);
const adminCtx = makeCtx({ userId: ADMIN_ID, role: 'admin' });
const clinicCtx = makeCtx({ userId: CLINIC_USER_ID, role: 'clinic' });
const ownerCtx = makeCtx({ userId: OWNER_USER_ID, role: 'owner' });

// ── Procedure matrix ─────────────────────────────────────────────────
// baseProcedure determines which roles can access:
//   public    → anyone (no auth check)
//   protected → any authenticated user
//   admin     → admin only
//   clinic    → clinic + admin
//   owner     → owner + admin

type Base = 'public' | 'protected' | 'admin' | 'clinic' | 'owner';

interface ProcSpec {
  path: string;
  base: Base;
}

const PROCEDURES: ProcSpec[] = [
  // root
  { path: 'health', base: 'public' },
  // enrollment
  { path: 'enrollment.create', base: 'clinic' },
  { path: 'enrollment.getSummary', base: 'protected' },
  { path: 'enrollment.cancel', base: 'protected' },
  // payment
  { path: 'payment.initiateDeposit', base: 'owner' },
  { path: 'payment.processInstallment', base: 'admin' },
  { path: 'payment.retryPayment', base: 'admin' },
  { path: 'payment.getDuePayments', base: 'admin' },
  { path: 'payment.escalateToDefault', base: 'admin' },
  { path: 'payment.getPlansForEscalation', base: 'admin' },
  // payout
  { path: 'payout.process', base: 'admin' },
  { path: 'payout.history', base: 'clinic' },
  { path: 'payout.earnings', base: 'clinic' },
  // plaid
  { path: 'plaid.createLinkToken', base: 'owner' },
  { path: 'plaid.exchangePublicToken', base: 'owner' },
  { path: 'plaid.checkBalance', base: 'owner' },
  // owner
  { path: 'owner.healthCheck', base: 'owner' },
  { path: 'owner.getProfile', base: 'owner' },
  { path: 'owner.updateProfile', base: 'owner' },
  { path: 'owner.updatePaymentMethod', base: 'owner' },
  { path: 'owner.getPlans', base: 'owner' },
  { path: 'owner.getPaymentHistory', base: 'owner' },
  { path: 'owner.getDashboardSummary', base: 'owner' },
  // clinic
  { path: 'clinic.healthCheck', base: 'clinic' },
  { path: 'clinic.search', base: 'protected' },
  { path: 'clinic.getProfile', base: 'clinic' },
  { path: 'clinic.updateProfile', base: 'clinic' },
  { path: 'clinic.startStripeOnboarding', base: 'clinic' },
  { path: 'clinic.getOnboardingStatus', base: 'clinic' },
  { path: 'clinic.completeOnboarding', base: 'clinic' },
  { path: 'clinic.getDashboardStats', base: 'clinic' },
  { path: 'clinic.getClients', base: 'clinic' },
  { path: 'clinic.getClientPlanDetails', base: 'clinic' },
  { path: 'clinic.getMonthlyRevenue', base: 'clinic' },
  { path: 'clinic.getRevenueReport', base: 'clinic' },
  { path: 'clinic.getEnrollmentTrends', base: 'clinic' },
  { path: 'clinic.getDefaultRate', base: 'clinic' },
  { path: 'clinic.exportClientsCSV', base: 'clinic' },
  { path: 'clinic.exportRevenueCSV', base: 'clinic' },
  { path: 'clinic.exportPayoutsCSV', base: 'clinic' },
  // plan
  { path: 'plan.healthCheck', base: 'protected' },
  // admin
  { path: 'admin.healthCheck', base: 'admin' },
  { path: 'admin.riskPoolBalance', base: 'admin' },
  { path: 'admin.riskPoolHealth', base: 'admin' },
  { path: 'admin.auditLogByEntity', base: 'admin' },
  { path: 'admin.auditLogByType', base: 'admin' },
  { path: 'admin.getPlatformStats', base: 'admin' },
  { path: 'admin.getClinics', base: 'admin' },
  { path: 'admin.updateClinicStatus', base: 'admin' },
  { path: 'admin.getPayments', base: 'admin' },
  { path: 'admin.retryPayment', base: 'admin' },
  { path: 'admin.getRiskPoolDetails', base: 'admin' },
  { path: 'admin.getDefaultedPlans', base: 'admin' },
  { path: 'admin.getRecentAuditLog', base: 'admin' },
  { path: 'admin.getSoftCollections', base: 'admin' },
  { path: 'admin.cancelSoftCollection', base: 'admin' },
  { path: 'admin.getSoftCollectionStats', base: 'admin' },
];

// ── Role access rules ────────────────────────────────────────────────

function allowedRoles(base: Base): string[] {
  switch (base) {
    case 'public':
      return ['owner', 'clinic', 'admin'];
    case 'protected':
      return ['owner', 'clinic', 'admin'];
    case 'admin':
      return ['admin'];
    case 'clinic':
      return ['clinic', 'admin'];
    case 'owner':
      return ['owner', 'admin'];
  }
}

// biome-ignore lint/suspicious/noExplicitAny: dynamic procedure access
function resolveProcedure(caller: any, path: string) {
  // nosemgrep: javascript.lang.security.audit.prototype-pollution.prototype-pollution-loop
  return path.split('.').reduce((obj, key) => (obj ? obj[key] : undefined), caller);
}

async function callAndGetErrorCode(
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  caller: any,
  path: string,
): Promise<string | null> {
  const fn = resolveProcedure(caller, path);
  if (typeof fn !== 'function') {
    throw new Error(
      `Procedure not found at path: ${path}. Check for typos in the PROCEDURES list.`,
    );
  }
  try {
    await fn();
    return null; // No error — auth passed
  } catch (err: unknown) {
    // biome-ignore lint/suspicious/noExplicitAny: error inspection
    return (err as any)?.code ?? 'UNKNOWN';
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Authorization matrix', () => {
  beforeEach(() => {
    mockSelectResult.mockReset();
    mockInsertReturning.mockReset();
    mockInsertReturning.mockImplementation(() => Promise.resolve([]));
  });

  afterEach(() => {
    mockSelectResult.mockReset();
    mockInsertReturning.mockReset();
  });

  for (const proc of PROCEDURES) {
    describe(proc.path, () => {
      it(
        proc.base === 'public'
          ? 'allows unauthenticated callers'
          : 'rejects unauthenticated callers',
        async () => {
          const caller = createCaller(unauthCtx);
          const code = await callAndGetErrorCode(caller, proc.path);
          if (proc.base === 'public') {
            expect(code).not.toBe('UNAUTHORIZED');
            expect(code).not.toBe('FORBIDDEN');
          } else {
            expect(code).toBe('UNAUTHORIZED');
          }
        },
      );

      for (const role of ['owner', 'clinic', 'admin'] as const) {
        const allowed = allowedRoles(proc.base);
        const isAllowed = allowed.includes(role);

        if (isAllowed) {
          it(`allows ${role} role`, async () => {
            // Set up DB mock to return a row for clinicProcedure/ownerProcedure lookups
            mockSelectResult.mockImplementation(() => {
              if (role === 'clinic') return [{ id: CLINIC_ROW_ID }];
              if (role === 'owner') return [{ id: OWNER_ROW_ID }];
              return [{ id: 'mock-id' }];
            });

            const ctxMap = { admin: adminCtx, clinic: clinicCtx, owner: ownerCtx };
            const caller = createCaller(ctxMap[role]);
            const code = await callAndGetErrorCode(caller, proc.path);
            // Auth should pass — error should NOT be auth-related
            expect(code).not.toBe('UNAUTHORIZED');
            expect(code).not.toBe('FORBIDDEN');
          });
        } else {
          it(`rejects ${role} role`, async () => {
            // DB mock not needed — FORBIDDEN thrown before DB access
            mockSelectResult.mockReturnValue([]);

            const ctxMap = { admin: adminCtx, clinic: clinicCtx, owner: ownerCtx };
            const caller = createCaller(ctxMap[role]);
            const code = await callAndGetErrorCode(caller, proc.path);
            expect(code).toBe('FORBIDDEN');
          });
        }
      }
    });
  }
});
