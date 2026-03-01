import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockIdentifyDuePayments = mock();
const mockIdentifyPlansForEscalation = mock();
const mockEscalateDefault = mock();

mock.module('@/server/services/collection', () => ({
  identifyDuePayments: mockIdentifyDuePayments,
  identifyPlansForEscalation: mockIdentifyPlansForEscalation,
  escalateDefault: mockEscalateDefault,
}));

const mockProcessInstallment = mock();

mock.module('@/server/services/payment', () => ({
  processInstallment: mockProcessInstallment,
}));

const mockIdentifyPendingEscalations = mock();
const mockEscalateSoftCollection = mock();

mock.module('@/server/services/soft-collection', () => ({
  identifyPendingEscalations: mockIdentifyPendingEscalations,
  escalateSoftCollection: mockEscalateSoftCollection,
}));

const mockLogger = {
  info: mock(),
  warn: mock(),
  error: mock(),
};

mock.module('@/lib/logger', () => ({
  logger: mockLogger,
}));

let mockCronSecret: string | undefined = 'test-cron-secret';

mock.module('@/lib/env', () => ({
  serverEnv: () => ({ CRON_SECRET: mockCronSecret }),
}));

const { GET } = await import('@/app/api/cron/collect-payments/route');

// ── Tests ────────────────────────────────────────────────────────────

describe('GET /api/cron/collect-payments', () => {
  beforeEach(() => {
    mockCronSecret = 'test-cron-secret';
    mockIdentifyDuePayments.mockResolvedValue([]);
    mockIdentifyPendingEscalations.mockResolvedValue([]);
    mockIdentifyPlansForEscalation.mockResolvedValue([]);
  });

  afterEach(() => {
    mockIdentifyDuePayments.mockClear();
    mockProcessInstallment.mockClear();
    mockIdentifyPendingEscalations.mockClear();
    mockEscalateSoftCollection.mockClear();
    mockIdentifyPlansForEscalation.mockClear();
    mockEscalateDefault.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  it('returns 401 when authorization header is missing', async () => {
    const request = new Request('http://localhost/api/cron/collect-payments');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when authorization header is invalid', async () => {
    const request = new Request('http://localhost/api/cron/collect-payments', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is not configured', async () => {
    mockCronSecret = undefined;

    const request = new Request('http://localhost/api/cron/collect-payments');
    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(mockIdentifyDuePayments).not.toHaveBeenCalled();
  });

  it('200 happy path: payments processed, soft collections escalated, plans escalated', async () => {
    mockIdentifyDuePayments.mockResolvedValue([{ id: 'pay-1' }, { id: 'pay-2' }, { id: 'pay-3' }]);
    mockProcessInstallment.mockResolvedValue(undefined);
    mockIdentifyPendingEscalations.mockResolvedValue([{ id: 'sc-1' }, { id: 'sc-2' }]);
    mockEscalateSoftCollection.mockResolvedValue(undefined);
    mockIdentifyPlansForEscalation.mockResolvedValue(['plan-1']);
    mockEscalateDefault.mockResolvedValue(undefined);

    const request = new Request('http://localhost/api/cron/collect-payments', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.duePayments).toBe(3);
    expect(body.processed).toBe(3);
    expect(body.failed).toBe(0);
    expect(body.softCollectionEscalations).toBe(2);
    expect(body.planEscalations).toBe(1);
  });

  it('200 with all zeros (empty arrays from all identify functions)', async () => {
    const request = new Request('http://localhost/api/cron/collect-payments', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.duePayments).toBe(0);
    expect(body.processed).toBe(0);
    expect(body.failed).toBe(0);
    expect(body.softCollectionEscalations).toBe(0);
    expect(body.planEscalations).toBe(0);
  });

  it('200 with partial installment failures (processInstallment throws for some)', async () => {
    mockIdentifyDuePayments.mockResolvedValue([{ id: 'pay-1' }, { id: 'pay-2' }, { id: 'pay-3' }]);
    mockProcessInstallment
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Stripe error'))
      .mockResolvedValueOnce(undefined);

    const request = new Request('http://localhost/api/cron/collect-payments', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.duePayments).toBe(3);
    expect(body.processed).toBe(2);
    expect(body.failed).toBe(1);
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to process installment', {
      error: 'Stripe error',
    });
  });

  it('200 soft collection escalation error logged, processing continues', async () => {
    mockIdentifyPendingEscalations.mockResolvedValue([{ id: 'sc-1' }, { id: 'sc-2' }]);
    mockEscalateSoftCollection
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce(undefined);

    const request = new Request('http://localhost/api/cron/collect-payments', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.softCollectionEscalations).toBe(1);
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to escalate soft collection', {
      error: 'DB error',
    });
  });

  it('200 plan escalation error logged, processing continues', async () => {
    mockIdentifyPlansForEscalation.mockResolvedValue(['plan-1', 'plan-2']);
    mockEscalateDefault
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Escalation failed'));

    const request = new Request('http://localhost/api/cron/collect-payments', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.planEscalations).toBe(1);
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to escalate plan to default', {
      error: 'Escalation failed',
    });
  });

  it('returns 500 when identifyDuePayments throws (top-level catch)', async () => {
    mockIdentifyDuePayments.mockRejectedValue(new Error('Database connection failed'));

    const request = new Request('http://localhost/api/cron/collect-payments', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const response = await GET(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Internal server error');
  });

  it('correct counts in mixed scenario', async () => {
    mockIdentifyDuePayments.mockResolvedValue([
      { id: 'pay-1' },
      { id: 'pay-2' },
      { id: 'pay-3' },
      { id: 'pay-4' },
    ]);
    mockProcessInstallment
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);
    mockIdentifyPendingEscalations.mockResolvedValue([{ id: 'sc-1' }]);
    mockEscalateSoftCollection.mockResolvedValue(undefined);
    mockIdentifyPlansForEscalation.mockResolvedValue(['plan-1', 'plan-2']);
    mockEscalateDefault.mockResolvedValue(undefined);

    const request = new Request('http://localhost/api/cron/collect-payments', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.duePayments).toBe(4);
    expect(body.processed).toBe(2);
    expect(body.failed).toBe(2);
    expect(body.softCollectionEscalations).toBe(1);
    expect(body.planEscalations).toBe(2);
  });
});
