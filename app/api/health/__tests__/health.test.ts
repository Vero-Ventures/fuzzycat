import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockDbExecute = mock();
const mockStripeBalanceRetrieve = mock();
let plaidShouldThrow = false;

mock.module('@/server/db', () => ({
  db: { execute: mockDbExecute },
}));

mock.module('@/lib/env', () => ({
  publicEnv: () => ({}),
  serverEnv: () => ({}),
}));

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    balance: { retrieve: mockStripeBalanceRetrieve },
  }),
}));

mock.module('@/lib/plaid', () => ({
  plaid: () => {
    if (plaidShouldThrow) {
      throw new Error('Plaid misconfigured');
    }
    return {};
  },
}));

const { GET } = await import('@/app/api/health/route');

// ── Tests ────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  beforeEach(() => {
    mockDbExecute.mockResolvedValue([{ '1': 1 }]);
    mockStripeBalanceRetrieve.mockResolvedValue({ available: [] });
    plaidShouldThrow = false;
  });

  afterEach(() => {
    mockDbExecute.mockClear();
    mockStripeBalanceRetrieve.mockClear();
  });

  it('returns "ok" when all services are healthy', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.checks.database.status).toBe('ok');
    expect(body.checks.stripe.status).toBe('ok');
    expect(body.checks.plaid.status).toBe('ok');
  });

  it('returns "degraded" when Stripe is down but DB is up', async () => {
    mockStripeBalanceRetrieve.mockRejectedValue(new Error('Stripe unreachable'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks.database.status).toBe('ok');
    expect(body.checks.stripe.status).toBe('fail');
    expect(body.checks.plaid.status).toBe('ok');
  });

  it('returns "degraded" when Plaid is misconfigured but DB is up', async () => {
    plaidShouldThrow = true;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks.database.status).toBe('ok');
    expect(body.checks.plaid.status).toBe('fail');
    expect(body.checks.plaid.error).toContain('Plaid misconfigured');
  });

  it('returns "error" when database is down', async () => {
    mockDbExecute.mockRejectedValue(new Error('Connection refused'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('error');
    expect(body.checks.database.status).toBe('fail');
  });

  it('returns "error" when database is down even if external services are fine', async () => {
    mockDbExecute.mockRejectedValue(new Error('DB timeout'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('error');
    expect(body.checks.stripe.status).toBe('ok');
    expect(body.checks.plaid.status).toBe('ok');
  });

  it('includes all check keys in response', async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.checks).toHaveProperty('publicEnv');
    expect(body.checks).toHaveProperty('serverEnv');
    expect(body.checks).toHaveProperty('database');
    expect(body.checks).toHaveProperty('stripe');
    expect(body.checks).toHaveProperty('plaid');
  });

  it('sets Cache-Control: no-store header', async () => {
    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
