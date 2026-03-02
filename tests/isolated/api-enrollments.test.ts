import { beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockCreateEnrollment = mock();
const mockGetEnrollmentSummary = mock();
const mockCancelEnrollment = mock();

mock.module('@/server/services/enrollment', () => ({
  createEnrollment: mockCreateEnrollment,
  getEnrollmentSummary: mockGetEnrollmentSummary,
  cancelEnrollment: mockCancelEnrollment,
}));

const mockValidateApiKey = mock();
mock.module('@/server/services/api-key', () => ({
  validateApiKey: mockValidateApiKey,
}));

const mockSelectLimit = mock();
const mockSelectWhere = mock();
const mockSelectFrom = mock();
const mockSelect = mock();

mock.module('@/server/db', () => ({
  db: {
    select: mockSelect,
  },
}));

import { schemaMock } from '../../server/__tests__/stripe/_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

mock.module('@/server/services/audit', () => ({
  logAuditEvent: mock(() => Promise.resolve()),
}));

mock.module('@/lib/logger', () => ({
  logger: { info: mock(), warn: mock(), error: mock() },
}));

mock.module('@/lib/env', () => ({
  serverEnv: () => ({}),
  publicEnv: () => ({}),
  _resetEnvCache: mock(),
}));

// Mock clinic-queries and payout services (imported by other route modules via createApiApp)
mock.module('@/server/services/clinic-queries', () => ({
  getClinicProfile: mock(),
  updateClinicProfile: mock(),
  getDashboardStats: mock(),
  getClientStats: mock(),
  getClients: mock(),
  getClientDetails: mock(),
  getClientPlanDetails: mock(),
  getMonthlyRevenue: mock(),
  getRevenueReport: mock(),
  getEnrollmentTrends: mock(),
  getDefaultRate: mock(),
  exportClientsCSV: mock(),
  exportRevenueCSV: mock(),
  exportPayoutsCSV: mock(),
}));

mock.module('@/server/services/payout', () => ({
  getClinicPayoutHistory: mock(),
  getClinicEarnings: mock(),
}));

// Must import AFTER mocks
const { createApiApp } = await import('@/server/api/app');

// ── Test data ────────────────────────────────────────────────────────

const CLINIC_ID = '11111111-1111-1111-8111-111111111111';
const PLAN_ID = '33333333-3333-3333-8333-333333333333';
const OWNER_ID = '22222222-2222-2222-8222-222222222222';
const API_KEY = 'fc_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1';

const VALID_ENROLLMENT = {
  ownerData: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+15551234567',
    petName: 'Whiskers',
    paymentMethod: 'debit_card',
    addressState: 'CA',
  },
  billAmountCents: 150000,
};

const MOCK_ENROLLMENT_RESULT = {
  planId: PLAN_ID,
  ownerId: OWNER_ID,
  paymentIds: ['pay-1', 'pay-2', 'pay-3'],
};

const MOCK_SUMMARY = {
  plan: {
    id: PLAN_ID,
    status: 'pending',
    totalBillCents: 150000,
    feeCents: 9000,
    totalWithFeeCents: 159000,
    depositCents: 39750,
    remainingCents: 119250,
    installmentCents: 19875,
    numInstallments: 6,
    createdAt: new Date('2026-03-01T12:00:00Z'),
  },
  owner: {
    id: OWNER_ID,
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+15551234567',
    petName: 'Whiskers',
  },
  clinic: {
    id: CLINIC_ID,
    name: 'Happy Paws Vet',
  },
  payments: [
    {
      id: 'pay-1',
      type: 'deposit',
      sequenceNum: 0,
      amountCents: 39750,
      status: 'pending',
      scheduledAt: new Date('2026-03-01T12:00:00Z'),
    },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────

function setupAuthMock(permissions: string[] = ['enrollments:read', 'enrollments:write']) {
  mockValidateApiKey.mockResolvedValue({
    id: 'key-1',
    clinicId: CLINIC_ID,
    permissions,
  });
}

function setupSelectChain(returnValue: unknown) {
  mockSelectLimit.mockReturnValue(Promise.resolve(returnValue));
  mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelect.mockReturnValue({ from: mockSelectFrom });
}

async function apiRequest(
  app: ReturnType<typeof createApiApp>,
  method: string,
  path: string,
  body?: unknown,
) {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return app.request(path, init);
}

// ── Tests ────────────────────────────────────────────────────────────

beforeEach(() => {
  mockCreateEnrollment.mockReset();
  mockGetEnrollmentSummary.mockReset();
  mockCancelEnrollment.mockReset();
  mockValidateApiKey.mockReset();
  mockSelect.mockReset();
  mockSelectFrom.mockReset();
  mockSelectWhere.mockReset();
  mockSelectLimit.mockReset();
});

describe('POST /enrollments', () => {
  it('creates enrollment and returns 201', async () => {
    const app = createApiApp();
    setupAuthMock();
    mockCreateEnrollment.mockResolvedValue(MOCK_ENROLLMENT_RESULT);

    const res = await apiRequest(app, 'POST', '/enrollments', VALID_ENROLLMENT);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.planId).toBe(PLAN_ID);
    expect(json.ownerId).toBe(OWNER_ID);
  });

  it('rejects NY addresses', async () => {
    const app = createApiApp();
    setupAuthMock();

    const res = await apiRequest(app, 'POST', '/enrollments', {
      ...VALID_ENROLLMENT,
      ownerData: { ...VALID_ENROLLMENT.ownerData, addressState: 'NY' },
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain('New York');
  });

  it('returns 401 without auth header', async () => {
    const app = createApiApp();

    const res = await app.request('/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_ENROLLMENT),
    });

    expect(res.status).toBe(401);
  });

  it('returns 403 without enrollments:write permission', async () => {
    const app = createApiApp();
    setupAuthMock(['enrollments:read']); // missing write

    const res = await apiRequest(app, 'POST', '/enrollments', VALID_ENROLLMENT);

    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid bill amount', async () => {
    const app = createApiApp();
    setupAuthMock();

    const res = await apiRequest(app, 'POST', '/enrollments', {
      ...VALID_ENROLLMENT,
      billAmountCents: 100, // below minimum
    });

    // Zod validation errors can return 400 or 422 depending on Hono's path
    expect([400, 422]).toContain(res.status);
  });
});

describe('GET /enrollments/:planId', () => {
  it('returns enrollment summary', async () => {
    const app = createApiApp();
    setupAuthMock();
    setupSelectChain([{ id: PLAN_ID }]);
    mockGetEnrollmentSummary.mockResolvedValue(MOCK_SUMMARY);

    const res = await apiRequest(app, 'GET', `/enrollments/${PLAN_ID}`);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.plan.id).toBe(PLAN_ID);
    expect(json.plan.createdAt).toBe('2026-03-01T12:00:00.000Z');
  });

  it('returns 404 when plan not found', async () => {
    const app = createApiApp();
    setupAuthMock();
    setupSelectChain([]); // no plan found

    const res = await apiRequest(app, 'GET', `/enrollments/${PLAN_ID}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 without enrollments:read permission', async () => {
    const app = createApiApp();
    setupAuthMock(['clinic:read']); // no enrollment perms

    const res = await apiRequest(app, 'GET', `/enrollments/${PLAN_ID}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /enrollments/:planId/cancel', () => {
  it('cancels enrollment and returns success', async () => {
    const app = createApiApp();
    setupAuthMock();
    setupSelectChain([{ id: PLAN_ID }]);
    mockCancelEnrollment.mockResolvedValue(undefined);

    const res = await apiRequest(app, 'POST', `/enrollments/${PLAN_ID}/cancel`);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('returns 404 when plan not in clinic', async () => {
    const app = createApiApp();
    setupAuthMock();
    setupSelectChain([]); // plan not found

    const res = await apiRequest(app, 'POST', `/enrollments/${PLAN_ID}/cancel`);

    expect(res.status).toBe(404);
  });

  it('returns 400 when plan cannot be cancelled', async () => {
    const app = createApiApp();
    setupAuthMock();
    setupSelectChain([{ id: PLAN_ID }]);
    mockCancelEnrollment.mockRejectedValue(new Error('Cannot cancel: status is completed'));

    const res = await apiRequest(app, 'POST', `/enrollments/${PLAN_ID}/cancel`);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain('Cannot cancel');
  });
});

describe('GET /health', () => {
  it('returns ok without auth', async () => {
    const app = createApiApp();

    const res = await app.request('/health');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
  });
});

describe('GET /openapi.json', () => {
  it('returns OpenAPI spec without auth', async () => {
    const app = createApiApp();

    const res = await app.request('/openapi.json');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.openapi).toBe('3.1.0');
    expect(json.info.title).toBe('FuzzyCat API');
  });
});
