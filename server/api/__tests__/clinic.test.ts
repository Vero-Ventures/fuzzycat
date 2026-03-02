import { beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockGetClinicProfile = mock();
const mockUpdateClinicProfile = mock();
const mockGetDashboardStats = mock();
const mockGetClientStats = mock();
const mockGetClients = mock();
const mockGetClientDetails = mock();
const mockGetClientPlanDetails = mock();
const mockGetMonthlyRevenue = mock();
const mockGetRevenueReport = mock();
const mockGetEnrollmentTrends = mock();
const mockGetDefaultRate = mock();
const mockExportClientsCSV = mock();
const mockExportRevenueCSV = mock();
const mockExportPayoutsCSV = mock();

mock.module('@/server/services/clinic-queries', () => ({
  getClinicProfile: mockGetClinicProfile,
  updateClinicProfile: mockUpdateClinicProfile,
  getDashboardStats: mockGetDashboardStats,
  getClientStats: mockGetClientStats,
  getClients: mockGetClients,
  getClientDetails: mockGetClientDetails,
  getClientPlanDetails: mockGetClientPlanDetails,
  getMonthlyRevenue: mockGetMonthlyRevenue,
  getRevenueReport: mockGetRevenueReport,
  getEnrollmentTrends: mockGetEnrollmentTrends,
  getDefaultRate: mockGetDefaultRate,
  exportClientsCSV: mockExportClientsCSV,
  exportRevenueCSV: mockExportRevenueCSV,
  exportPayoutsCSV: mockExportPayoutsCSV,
}));

const mockValidateApiKey = mock();
mock.module('@/server/services/api-key', () => ({
  validateApiKey: mockValidateApiKey,
}));

// Enrollment service mock (needed by app.ts import chain)
mock.module('@/server/services/enrollment', () => ({
  createEnrollment: mock(),
  getEnrollmentSummary: mock(),
  cancelEnrollment: mock(),
}));

mock.module('@/server/db', () => ({
  db: { select: mock(), update: mock() },
}));

import { schemaMock } from '../../__tests__/stripe/_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

mock.module('@/server/services/audit', () => ({
  logAuditEvent: mock(() => Promise.resolve()),
}));

mock.module('@/lib/logger', () => ({
  logger: { info: mock(), warn: mock(), error: mock() },
}));

const { createApiApp } = await import('@/server/api/app');

// ── Test data ────────────────────────────────────────────────────────

const CLINIC_ID = '11111111-1111-1111-8111-111111111111';
const PLAN_ID = '33333333-3333-3333-8333-333333333333';
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

async function apiPatch(app: ReturnType<typeof createApiApp>, path: string, body: unknown) {
  return app.request(path, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────────

beforeEach(() => {
  for (const fn of [
    mockGetClinicProfile,
    mockUpdateClinicProfile,
    mockGetDashboardStats,
    mockGetClientStats,
    mockGetClients,
    mockGetClientDetails,
    mockGetClientPlanDetails,
    mockGetMonthlyRevenue,
    mockGetRevenueReport,
    mockGetEnrollmentTrends,
    mockGetDefaultRate,
    mockExportClientsCSV,
    mockExportRevenueCSV,
    mockExportPayoutsCSV,
    mockValidateApiKey,
  ]) {
    fn.mockReset();
  }
});

describe('GET /clinic/profile', () => {
  it('returns clinic profile', async () => {
    const app = createApiApp();
    setupAuth(['clinic:read']);
    mockGetClinicProfile.mockResolvedValue({
      id: CLINIC_ID,
      name: 'Happy Paws',
      email: 'clinic@test.com',
    });

    const res = await apiGet(app, '/clinic/profile');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe('Happy Paws');
  });

  it('returns 404 when profile not found', async () => {
    const app = createApiApp();
    setupAuth(['clinic:read']);
    mockGetClinicProfile.mockResolvedValue(null);

    const res = await apiGet(app, '/clinic/profile');
    expect(res.status).toBe(404);
  });

  it('returns 403 without clinic:read', async () => {
    const app = createApiApp();
    setupAuth(['enrollments:read']);

    const res = await apiGet(app, '/clinic/profile');
    expect(res.status).toBe(403);
  });
});

describe('PATCH /clinic/profile', () => {
  it('updates profile', async () => {
    const app = createApiApp();
    setupAuth(['clinic:read', 'clinic:write']);
    mockGetClinicProfile.mockResolvedValue({ id: CLINIC_ID }); // for GET middleware
    mockUpdateClinicProfile.mockResolvedValue({
      id: CLINIC_ID,
      name: 'New Name',
    });

    const res = await apiPatch(app, '/clinic/profile', { name: 'New Name' });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe('New Name');
  });
});

describe('GET /clinic/stats', () => {
  it('returns dashboard stats', async () => {
    const app = createApiApp();
    setupAuth(['clinic:read']);
    mockGetDashboardStats.mockResolvedValue({
      activePlans: 5,
      totalRevenueCents: 100000,
    });

    const res = await apiGet(app, '/clinic/stats');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.activePlans).toBe(5);
  });
});

describe('GET /clinic/stats/clients', () => {
  it('returns client stats', async () => {
    const app = createApiApp();
    setupAuth(['clinic:read']);
    mockGetClientStats.mockResolvedValue({
      activePlans: 3,
      totalOutstandingCents: 50000,
      defaultRate: 2.5,
    });

    const res = await apiGet(app, '/clinic/stats/clients');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.activePlans).toBe(3);
  });
});

describe('GET /clinic/stats/defaults', () => {
  it('returns default rate', async () => {
    const app = createApiApp();
    setupAuth(['clinic:read']);
    mockGetDefaultRate.mockResolvedValue({
      totalPlans: 100,
      defaultedPlans: 3,
      defaultRate: 3.0,
    });

    const res = await apiGet(app, '/clinic/stats/defaults');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.defaultRate).toBe(3.0);
  });
});

describe('GET /clinic/stats/trends', () => {
  it('returns enrollment trends', async () => {
    const app = createApiApp();
    setupAuth(['clinic:read']);
    mockGetEnrollmentTrends.mockResolvedValue([
      { month: '2026-01', enrollments: 5 },
      { month: '2026-02', enrollments: 8 },
    ]);

    const res = await apiGet(app, '/clinic/stats/trends');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
  });
});

describe('GET /clinic/clients', () => {
  it('returns paginated client list', async () => {
    const app = createApiApp();
    setupAuth(['clients:read']);
    mockGetClients.mockResolvedValue({
      clients: [{ planId: PLAN_ID, ownerName: 'Jane' }],
      pagination: { page: 1, pageSize: 20, totalCount: 1, totalPages: 1 },
    });

    const res = await apiGet(app, '/clinic/clients');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.clients).toHaveLength(1);
  });

  it('returns 403 without clients:read', async () => {
    const app = createApiApp();
    setupAuth(['clinic:read']);

    const res = await apiGet(app, '/clinic/clients');
    expect(res.status).toBe(403);
  });
});

describe('GET /clinic/clients/:planId', () => {
  it('returns client details', async () => {
    const app = createApiApp();
    setupAuth(['clients:read']);
    mockGetClientDetails.mockResolvedValue({
      owner: { name: 'Jane', email: 'jane@test.com' },
      plans: [],
    });

    const res = await apiGet(app, `/clinic/clients/${PLAN_ID}`);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.owner.name).toBe('Jane');
  });

  it('returns 404 when not found', async () => {
    const app = createApiApp();
    setupAuth(['clients:read']);
    mockGetClientDetails.mockResolvedValue(null);

    const res = await apiGet(app, `/clinic/clients/${PLAN_ID}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /clinic/plans/:planId', () => {
  it('returns plan with payments and payouts', async () => {
    const app = createApiApp();
    setupAuth(['clients:read']);
    mockGetClientPlanDetails.mockResolvedValue({
      plan: { id: PLAN_ID },
      payments: [],
      payouts: [],
    });

    const res = await apiGet(app, `/clinic/plans/${PLAN_ID}`);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.plan.id).toBe(PLAN_ID);
  });
});

describe('GET /clinic/revenue', () => {
  it('returns monthly revenue', async () => {
    const app = createApiApp();
    setupAuth(['clinic:read']);
    mockGetMonthlyRevenue.mockResolvedValue([{ month: '2026-01', totalPayoutCents: 10000 }]);

    const res = await apiGet(app, '/clinic/revenue');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
  });
});

describe('GET /clinic/revenue/report', () => {
  it('returns revenue report for date range', async () => {
    const app = createApiApp();
    setupAuth(['clinic:read']);
    mockGetRevenueReport.mockResolvedValue([{ month: '2026-01', revenueCents: 50000 }]);

    const res = await apiGet(
      app,
      '/clinic/revenue/report?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-03-01T00:00:00Z',
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
  });
});

describe('GET /clinic/export/clients', () => {
  it('returns CSV', async () => {
    const app = createApiApp();
    setupAuth(['export:read']);
    mockExportClientsCSV.mockResolvedValue({ csv: 'Name,Email\nJane,jane@test.com' });

    const res = await apiGet(app, '/clinic/export/clients');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.csv).toContain('Jane');
  });

  it('returns 403 without export:read', async () => {
    const app = createApiApp();
    setupAuth(['clinic:read']);

    const res = await apiGet(app, '/clinic/export/clients');
    expect(res.status).toBe(403);
  });
});

describe('GET /clinic/export/revenue', () => {
  it('returns revenue CSV', async () => {
    const app = createApiApp();
    setupAuth(['export:read']);
    mockExportRevenueCSV.mockResolvedValue({ csv: 'Month,Revenue\n2026-01,$100' });

    const res = await apiGet(
      app,
      '/clinic/export/revenue?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-03-01T00:00:00Z',
    );

    expect(res.status).toBe(200);
  });
});

describe('GET /clinic/export/payouts', () => {
  it('returns payouts CSV', async () => {
    const app = createApiApp();
    setupAuth(['export:read']);
    mockExportPayoutsCSV.mockResolvedValue({ csv: 'ID,Amount\nabc,$100' });

    const res = await apiGet(app, '/clinic/export/payouts');

    expect(res.status).toBe(200);
  });
});
