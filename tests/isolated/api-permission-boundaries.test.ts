import { beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockValidateApiKey = mock();
mock.module('@/server/services/api-key', () => ({
  generateApiKey: mock(),
  validateApiKey: mockValidateApiKey,
  revokeApiKey: mock(),
  listApiKeys: mock(),
}));

mock.module('@/server/services/enrollment', () => ({
  createEnrollment: mock(),
  getEnrollmentSummary: mock(),
  cancelEnrollment: mock(),
}));

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
  calculatePayoutBreakdown: mock(),
  calculateApplicationFee: mock(),
}));

mock.module('@/server/services/webhook', () => ({
  createWebhookEndpoint: mock(),
  listWebhookEndpoints: mock(),
  updateWebhookEndpoint: mock(),
  deleteWebhookEndpoint: mock(),
  dispatchWebhookEvent: mock(),
  processWebhookRetries: mock(),
  signPayload: mock(),
  verifySignature: mock(),
  WEBHOOK_EVENTS: ['enrollment.created', 'payment.succeeded'],
}));

mock.module('@/server/db', () => ({
  db: { select: mock() },
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

const { createApiApp } = await import('@/server/api/app');

// ── Test data ────────────────────────────────────────────────────────

const CLINIC_ID = '11111111-1111-1111-8111-111111111111';
const API_KEY = 'fc_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1';

// ── Helpers ──────────────────────────────────────────────────────────

function setupAuth(permissions: string[]) {
  mockValidateApiKey.mockResolvedValue({
    id: 'key-1',
    clinicId: CLINIC_ID,
    permissions,
  });
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

async function apiGet(app: ReturnType<typeof createApiApp>, path: string) {
  return apiRequest(app, 'GET', path);
}

// ── Tests ────────────────────────────────────────────────────────────

beforeEach(() => {
  mockValidateApiKey.mockReset();
});

describe('enrollments:read only — cannot access other scopes', () => {
  const app = createApiApp();

  beforeEach(() => {
    setupAuth(['enrollments:read']);
  });

  it('403 on POST /enrollments (requires enrollments:write)', async () => {
    const res = await apiRequest(app, 'POST', '/enrollments', {
      ownerData: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+15551234567',
        petName: 'Whiskers',
        paymentMethod: 'debit_card',
        addressState: 'CA',
      },
      billAmountCents: 150000,
    });
    expect(res.status).toBe(403);
  });

  it('403 on GET /clinic/profile (requires clinic:read)', async () => {
    const res = await apiGet(app, '/clinic/profile');
    expect(res.status).toBe(403);
  });

  it('403 on GET /payouts (requires payouts:read)', async () => {
    const res = await apiGet(app, '/payouts');
    expect(res.status).toBe(403);
  });

  it('403 on GET /clinic/export/clients (requires export:read)', async () => {
    const res = await apiGet(app, '/clinic/export/clients');
    expect(res.status).toBe(403);
  });

  it('403 on GET /clinic/clients (requires clients:read)', async () => {
    const res = await apiGet(app, '/clinic/clients');
    expect(res.status).toBe(403);
  });
});

describe('clinic:read only — cannot access write or other scopes', () => {
  const app = createApiApp();

  beforeEach(() => {
    setupAuth(['clinic:read']);
  });

  it('403 on PATCH /clinic/profile (requires clinic:write)', async () => {
    const res = await apiRequest(app, 'PATCH', '/clinic/profile', { name: 'New Name' });
    expect(res.status).toBe(403);
  });

  it('403 on POST /enrollments (requires enrollments:write)', async () => {
    const res = await apiRequest(app, 'POST', '/enrollments', {
      ownerData: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+15551234567',
        petName: 'Whiskers',
        paymentMethod: 'debit_card',
        addressState: 'CA',
      },
      billAmountCents: 150000,
    });
    expect(res.status).toBe(403);
  });

  it('403 on GET /payouts (requires payouts:read)', async () => {
    const res = await apiGet(app, '/payouts');
    expect(res.status).toBe(403);
  });

  it('403 on GET /clinic/export/clients (requires export:read)', async () => {
    const res = await apiGet(app, '/clinic/export/clients');
    expect(res.status).toBe(403);
  });

  it('403 on GET /clinic/clients (requires clients:read)', async () => {
    const res = await apiGet(app, '/clinic/clients');
    expect(res.status).toBe(403);
  });

  it('403 on POST /webhooks (requires clinic:write)', async () => {
    const res = await apiRequest(app, 'POST', '/webhooks', {
      url: 'https://example.com/webhook',
      events: ['enrollment.created'],
    });
    expect(res.status).toBe(403);
  });
});

describe('payouts:read only — cannot access other scopes', () => {
  const app = createApiApp();

  beforeEach(() => {
    setupAuth(['payouts:read']);
  });

  it('403 on GET /clinic/profile (requires clinic:read)', async () => {
    const res = await apiGet(app, '/clinic/profile');
    expect(res.status).toBe(403);
  });

  it('403 on POST /enrollments (requires enrollments:write)', async () => {
    const res = await apiRequest(app, 'POST', '/enrollments', {
      ownerData: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+15551234567',
        petName: 'Whiskers',
        paymentMethod: 'debit_card',
        addressState: 'CA',
      },
      billAmountCents: 150000,
    });
    expect(res.status).toBe(403);
  });

  it('403 on GET /clinic/export/clients (requires export:read)', async () => {
    const res = await apiGet(app, '/clinic/export/clients');
    expect(res.status).toBe(403);
  });

  it('403 on GET /clinic/clients (requires clients:read)', async () => {
    const res = await apiGet(app, '/clinic/clients');
    expect(res.status).toBe(403);
  });
});

describe('export:read only — cannot access other scopes', () => {
  const app = createApiApp();

  beforeEach(() => {
    setupAuth(['export:read']);
  });

  it('403 on GET /clinic/profile (requires clinic:read)', async () => {
    const res = await apiGet(app, '/clinic/profile');
    expect(res.status).toBe(403);
  });

  it('403 on POST /enrollments (requires enrollments:write)', async () => {
    const res = await apiRequest(app, 'POST', '/enrollments', {
      ownerData: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+15551234567',
        petName: 'Whiskers',
        paymentMethod: 'debit_card',
        addressState: 'CA',
      },
      billAmountCents: 150000,
    });
    expect(res.status).toBe(403);
  });

  it('403 on GET /payouts (requires payouts:read)', async () => {
    const res = await apiGet(app, '/payouts');
    expect(res.status).toBe(403);
  });

  it('403 on GET /clinic/clients (requires clients:read)', async () => {
    const res = await apiGet(app, '/clinic/clients');
    expect(res.status).toBe(403);
  });
});

describe('clients:read only — cannot access other scopes', () => {
  const app = createApiApp();

  beforeEach(() => {
    setupAuth(['clients:read']);
  });

  it('403 on PATCH /clinic/profile (requires clinic:write)', async () => {
    const res = await apiRequest(app, 'PATCH', '/clinic/profile', { name: 'New Name' });
    expect(res.status).toBe(403);
  });

  it('403 on POST /enrollments (requires enrollments:write)', async () => {
    const res = await apiRequest(app, 'POST', '/enrollments', {
      ownerData: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+15551234567',
        petName: 'Whiskers',
        paymentMethod: 'debit_card',
        addressState: 'CA',
      },
      billAmountCents: 150000,
    });
    expect(res.status).toBe(403);
  });

  it('403 on GET /payouts (requires payouts:read)', async () => {
    const res = await apiGet(app, '/payouts');
    expect(res.status).toBe(403);
  });

  it('403 on GET /clinic/export/clients (requires export:read)', async () => {
    const res = await apiGet(app, '/clinic/export/clients');
    expect(res.status).toBe(403);
  });

  it('403 on GET /clinic/stats (requires clinic:read)', async () => {
    const res = await apiGet(app, '/clinic/stats');
    expect(res.status).toBe(403);
  });
});
