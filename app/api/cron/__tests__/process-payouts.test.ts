import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockProcessPendingPayouts = mock();

mock.module('@/server/services/payout', () => ({
  processPendingPayouts: mockProcessPendingPayouts,
}));

mock.module('@/lib/logger', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

let mockCronSecret: string | undefined = 'test-cron-secret';

mock.module('@/lib/env', () => ({
  serverEnv: () => ({ CRON_SECRET: mockCronSecret }),
}));

const { GET } = await import('@/app/api/cron/process-payouts/route');

// ── Tests ────────────────────────────────────────────────────────────

describe('GET /api/cron/process-payouts', () => {
  beforeEach(() => {
    mockCronSecret = 'test-cron-secret';
    mockProcessPendingPayouts.mockResolvedValue({
      processed: 2,
      succeeded: 2,
      failed: 0,
      results: [
        { payoutId: 'p1', status: 'succeeded', stripeTransferId: 'tr_1' },
        { payoutId: 'p2', status: 'succeeded', stripeTransferId: 'tr_2' },
      ],
    });
  });

  afterEach(() => {
    mockProcessPendingPayouts.mockClear();
  });

  it('returns 401 when authorization header is missing', async () => {
    const request = new Request('http://localhost/api/cron/process-payouts');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when authorization header is invalid', async () => {
    const request = new Request('http://localhost/api/cron/process-payouts', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('processes payouts with valid authorization', async () => {
    const request = new Request('http://localhost/api/cron/process-payouts', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(2);
    expect(body.succeeded).toBe(2);
    expect(body.failed).toBe(0);
    expect(body.results).toHaveLength(2);
  });

  it('skips auth check when CRON_SECRET is not configured', async () => {
    mockCronSecret = undefined;

    const request = new Request('http://localhost/api/cron/process-payouts');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockProcessPendingPayouts).toHaveBeenCalled();
  });

  it('returns 500 when processPendingPayouts throws', async () => {
    mockProcessPendingPayouts.mockRejectedValue(new Error('Database connection failed'));

    const request = new Request('http://localhost/api/cron/process-payouts', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const response = await GET(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Internal server error');
  });

  it('returns results including failed payouts', async () => {
    mockProcessPendingPayouts.mockResolvedValue({
      processed: 2,
      succeeded: 1,
      failed: 1,
      results: [
        { payoutId: 'p1', status: 'succeeded', stripeTransferId: 'tr_1' },
        { payoutId: 'p2', status: 'failed', error: 'Stripe error' },
      ],
    });

    const request = new Request('http://localhost/api/cron/process-payouts', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const response = await GET(request);

    const body = await response.json();
    expect(body.succeeded).toBe(1);
    expect(body.failed).toBe(1);
  });
});
