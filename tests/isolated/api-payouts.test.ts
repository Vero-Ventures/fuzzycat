import { beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockGetClinicPayoutHistory = mock();
const mockGetClinicEarnings = mock();

mock.module('@/server/services/payout', () => ({
  getClinicPayoutHistory: mockGetClinicPayoutHistory,
  getClinicEarnings: mockGetClinicEarnings,
  processClinicPayout: mock(),
  processPendingPayouts: mock(),
  calculatePayoutBreakdown: mock(),
}));

const mockValidateApiKey = mock();
mock.module('@/server/services/api-key', () => ({
  generateApiKey: mock(),
  validateApiKey: mockValidateApiKey,
  revokeApiKey: mock(),
  listApiKeys: mock(),
}));

// Other mocks needed by the app import chain
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

async function apiGet(app: ReturnType<typeof createApiApp>, path: string) {
  return app.request(path, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
}

// ── Tests ────────────────────────────────────────────────────────────

beforeEach(() => {
  mockGetClinicPayoutHistory.mockReset();
  mockGetClinicEarnings.mockReset();
  mockValidateApiKey.mockReset();
});

describe('GET /payouts', () => {
  it('returns paginated payout history', async () => {
    const app = createApiApp();
    setupAuth(['payouts:read']);
    mockGetClinicPayoutHistory.mockResolvedValue({
      payouts: [
        {
          id: 'payout-1',
          amountCents: 10000,
          clinicShareCents: 300,
          status: 'succeeded',
        },
      ],
      total: 1,
    });

    const res = await apiGet(app, '/payouts');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.payouts).toHaveLength(1);
    expect(json.total).toBe(1);
  });

  it('passes limit and offset params', async () => {
    const app = createApiApp();
    setupAuth(['payouts:read']);
    mockGetClinicPayoutHistory.mockResolvedValue({ payouts: [], total: 0 });

    const res = await apiGet(app, '/payouts?limit=5&offset=10');

    expect(res.status).toBe(200);
    expect(mockGetClinicPayoutHistory).toHaveBeenCalledWith(CLINIC_ID, {
      limit: 5,
      offset: 10,
    });
  });

  it('returns 403 without payouts:read', async () => {
    const app = createApiApp();
    setupAuth(['clinic:read']);

    const res = await apiGet(app, '/payouts');
    expect(res.status).toBe(403);
  });

  it('returns empty list when no payouts', async () => {
    const app = createApiApp();
    setupAuth(['payouts:read']);
    mockGetClinicPayoutHistory.mockResolvedValue({ payouts: [], total: 0 });

    const res = await apiGet(app, '/payouts');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.payouts).toHaveLength(0);
    expect(json.total).toBe(0);
  });
});

describe('GET /payouts/earnings', () => {
  it('returns earnings summary', async () => {
    const app = createApiApp();
    setupAuth(['payouts:read']);
    mockGetClinicEarnings.mockResolvedValue({
      totalPayoutCents: 500000,
      totalClinicShareCents: 15000,
      pendingPayoutCents: 10000,
      completedPayoutCount: 25,
    });

    const res = await apiGet(app, '/payouts/earnings');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.totalPayoutCents).toBe(500000);
    expect(json.completedPayoutCount).toBe(25);
  });

  it('returns 403 without payouts:read', async () => {
    const app = createApiApp();
    setupAuth(['clinic:read']);

    const res = await apiGet(app, '/payouts/earnings');
    expect(res.status).toBe(403);
  });

  it('returns zero values when no payouts', async () => {
    const app = createApiApp();
    setupAuth(['payouts:read']);
    mockGetClinicEarnings.mockResolvedValue({
      totalPayoutCents: 0,
      totalClinicShareCents: 0,
      pendingPayoutCents: 0,
      completedPayoutCount: 0,
    });

    const res = await apiGet(app, '/payouts/earnings');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.totalPayoutCents).toBe(0);
  });
});
