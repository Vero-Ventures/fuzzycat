import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockLinkTokenCreate = mock(() =>
  Promise.resolve({
    data: { link_token: 'link-sandbox-test-token-123' },
  }),
);

const mockItemPublicTokenExchange = mock(() =>
  Promise.resolve({
    data: {
      access_token: 'access-sandbox-test-token-456',
      item_id: 'item-sandbox-test-789',
    },
  }),
);

const mockAccountsBalanceGet = mock(
  (): Promise<unknown> =>
    Promise.resolve({
      data: {
        accounts: [
          {
            account_id: 'acc-1',
            balances: {
              available: 1500.0,
              current: 1500.0,
              iso_currency_code: 'USD',
            },
          },
        ],
      },
    }),
);

mock.module('@/lib/plaid', () => ({
  plaid: () => ({
    linkTokenCreate: mockLinkTokenCreate,
    itemPublicTokenExchange: mockItemPublicTokenExchange,
    accountsBalanceGet: mockAccountsBalanceGet,
  }),
}));

mock.module('@/lib/logger', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

// DB mock setup
const mockSelectLimit = mock();
const mockSelectWhere = mock();
const mockSelectFrom = mock();
const mockSelect = mock();
const mockUpdateSet = mock();
const mockUpdateWhere = mock();
const mockUpdate = mock();
const mockInsertValues = mock();
const mockInsert = mock();

mock.module('@/server/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  },
}));

mock.module('@/server/db/schema', () => ({
  owners: {
    id: 'owners.id',
    plaidAccessToken: 'owners.plaid_access_token',
    plaidItemId: 'owners.plaid_item_id',
    stripeCustomerId: 'owners.stripe_customer_id',
  },
  clinics: { id: 'clinics.id' },
  plans: { id: 'plans.id', status: 'plans.status' },
  payments: { id: 'payments.id' },
  payouts: { id: 'payouts.id' },
  auditLog: {
    id: 'auditLog.id',
    entityType: 'auditLog.entity_type',
    entityId: 'auditLog.entity_id',
    createdAt: 'auditLog.created_at',
  },
  riskPool: { id: 'riskPool.id' },
  clinicStatusEnum: {},
  paymentMethodEnum: {},
  planStatusEnum: {},
  paymentTypeEnum: {},
  paymentStatusEnum: {},
  payoutStatusEnum: {},
  riskPoolTypeEnum: {},
  actorTypeEnum: {},
  clinicsRelations: {},
  ownersRelations: {},
  plansRelations: {},
  paymentsRelations: {},
  payoutsRelations: {},
  riskPoolRelations: {},
  softCollections: {
    id: 'soft_collections.id',
    planId: 'soft_collections.plan_id',
    stage: 'soft_collections.stage',
    nextEscalationAt: 'soft_collections.next_escalation_at',
  },
}));

mock.module('drizzle-orm', () => ({
  eq: (col: string, val: string) => ({ col, val, type: 'eq' }),
  and: (...args: unknown[]) => ({ args, type: 'and' }),
  desc: (col: string) => ({ col, type: 'desc' }),
}));

import { createAuditMock } from './audit-mock';

mock.module('@/server/services/audit', () => createAuditMock(mockInsert));

const { createLinkToken, exchangePublicToken, checkBalance } = await import(
  '@/server/services/plaid'
);

// ── Helpers ──────────────────────────────────────────────────────────

function setupSelectChain() {
  mockSelectLimit.mockReturnValue([]);
  mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelect.mockReturnValue({ from: mockSelectFrom });
}

function setupUpdateChain() {
  mockUpdateWhere.mockResolvedValue([]);
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
}

function setupInsertChain() {
  mockInsertValues.mockResolvedValue([]);
  mockInsert.mockReturnValue({ values: mockInsertValues });
}

function clearAllMocks() {
  for (const m of [
    mockSelect,
    mockSelectFrom,
    mockSelectWhere,
    mockSelectLimit,
    mockUpdate,
    mockUpdateSet,
    mockUpdateWhere,
    mockInsert,
    mockInsertValues,
    mockLinkTokenCreate,
    mockItemPublicTokenExchange,
    mockAccountsBalanceGet,
  ]) {
    m.mockClear();
  }
}

// ── Tests: createLinkToken ───────────────────────────────────────────

describe('createLinkToken', () => {
  afterEach(clearAllMocks);

  it('returns a link token for a valid user ID', async () => {
    const token = await createLinkToken('user-123');

    expect(token).toBe('link-sandbox-test-token-123');
    expect(mockLinkTokenCreate).toHaveBeenCalledTimes(1);
    expect(mockLinkTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { client_user_id: 'user-123' },
        client_name: 'FuzzyCat',
        language: 'en',
      }),
    );
  });

  it('propagates errors from Plaid API', async () => {
    mockLinkTokenCreate.mockRejectedValueOnce(new Error('Plaid API error'));

    await expect(createLinkToken('user-fail')).rejects.toThrow('Plaid API error');
  });
});

// ── Tests: exchangePublicToken ───────────────────────────────────────

describe('exchangePublicToken', () => {
  beforeEach(() => {
    setupUpdateChain();
    setupInsertChain();
  });

  afterEach(clearAllMocks);

  it('exchanges public token and stores access token', async () => {
    const result = await exchangePublicToken('public-sandbox-test-token', 'owner-1');

    expect(result.accessToken).toBe('access-sandbox-test-token-456');
    expect(result.itemId).toBe('item-sandbox-test-789');

    // Verify Plaid API was called
    expect(mockItemPublicTokenExchange).toHaveBeenCalledWith({
      public_token: 'public-sandbox-test-token',
    });

    // Verify DB update was called to store access token and item ID
    expect(mockUpdateSet).toHaveBeenCalledWith({
      plaidAccessToken: 'access-sandbox-test-token-456',
      plaidItemId: 'item-sandbox-test-789',
    });
  });

  it('creates an audit log entry', async () => {
    await exchangePublicToken('public-sandbox-test-token', 'owner-1');

    // Audit log is written via logAuditEvent which calls db.insert
    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'owner',
        entityId: 'owner-1',
        action: 'status_changed',
        actorType: 'owner',
        actorId: 'owner-1',
      }),
    );
  });

  it('propagates errors from Plaid API', async () => {
    mockItemPublicTokenExchange.mockRejectedValueOnce(new Error('Invalid public token'));

    await expect(exchangePublicToken('bad-token', 'owner-1')).rejects.toThrow(
      'Invalid public token',
    );
  });
});

// ── Tests: checkBalance ──────────────────────────────────────────────

describe('checkBalance', () => {
  beforeEach(() => {
    setupSelectChain();
    setupInsertChain();
  });

  afterEach(clearAllMocks);

  it('approves when balance is sufficient', async () => {
    // Owner lookup returns owner with Plaid access token
    mockSelectLimit.mockResolvedValueOnce([{ plaidAccessToken: 'access-sandbox-test-token' }]);

    // Plaid returns $1500 available (150000 cents)
    mockAccountsBalanceGet.mockResolvedValueOnce({
      data: {
        accounts: [
          {
            account_id: 'acc-1',
            balances: { available: 1500.0, current: 1500.0 },
          },
        ],
      },
    });

    const result = await checkBalance('owner-1', 100_000); // $1000 required

    expect(result.approved).toBe(true);
    expect(result.availableBalanceCents).toBe(150_000);
    expect(result.requiredCents).toBe(100_000);
    expect(result.reason).toBe('Sufficient balance available');
  });

  it('declines when balance is insufficient', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ plaidAccessToken: 'access-sandbox-test-token' }]);

    mockAccountsBalanceGet.mockResolvedValueOnce({
      data: {
        accounts: [
          {
            account_id: 'acc-1',
            balances: { available: 50.0, current: 50.0 },
          },
        ],
      },
    });

    const result = await checkBalance('owner-1', 100_000); // $1000 required, only $50 available

    expect(result.approved).toBe(false);
    expect(result.availableBalanceCents).toBe(5_000);
    expect(result.requiredCents).toBe(100_000);
    expect(result.reason).toContain('Insufficient balance');
  });

  it('declines when no accounts are found', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ plaidAccessToken: 'access-sandbox-test-token' }]);

    mockAccountsBalanceGet.mockResolvedValueOnce({
      data: { accounts: [] },
    });

    const result = await checkBalance('owner-1', 100_000);

    expect(result.approved).toBe(false);
    expect(result.availableBalanceCents).toBe(0);
    expect(result.reason).toBe('No bank accounts found');
  });

  it('throws when owner is not found', async () => {
    mockSelectLimit.mockResolvedValueOnce([]);

    await expect(checkBalance('owner-missing', 100_000)).rejects.toThrow(
      'Owner not found: owner-missing',
    );
  });

  it('throws when owner has no Plaid access token', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ plaidAccessToken: null }]);

    await expect(checkBalance('owner-no-plaid', 100_000)).rejects.toThrow(
      'does not have a connected bank account',
    );
  });

  it('uses highest available balance across multiple accounts', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ plaidAccessToken: 'access-sandbox-test-token' }]);

    mockAccountsBalanceGet.mockResolvedValueOnce({
      data: {
        accounts: [
          {
            account_id: 'acc-1',
            balances: { available: 200.0, current: 200.0 },
          },
          {
            account_id: 'acc-2',
            balances: { available: 3000.0, current: 3000.0 },
          },
          {
            account_id: 'acc-3',
            balances: { available: 500.0, current: 500.0 },
          },
        ],
      },
    });

    const result = await checkBalance('owner-1', 250_000); // $2500 required

    expect(result.approved).toBe(true);
    expect(result.availableBalanceCents).toBe(300_000); // $3000 from acc-2
  });

  it('falls back to current balance when available is null', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ plaidAccessToken: 'access-sandbox-test-token' }]);

    mockAccountsBalanceGet.mockResolvedValueOnce({
      data: {
        accounts: [
          {
            account_id: 'acc-1',
            balances: { available: null, current: 800.0 },
          },
        ],
      },
    });

    const result = await checkBalance('owner-1', 50_000); // $500 required

    expect(result.approved).toBe(true);
    expect(result.availableBalanceCents).toBe(80_000);
  });

  it('creates an audit log entry for balance check', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ plaidAccessToken: 'access-sandbox-test-token' }]);

    mockAccountsBalanceGet.mockResolvedValueOnce({
      data: {
        accounts: [
          {
            account_id: 'acc-1',
            balances: { available: 1500.0, current: 1500.0 },
          },
        ],
      },
    });

    await checkBalance('owner-1', 100_000);

    // Audit log is written via logAuditEvent
    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'owner',
        entityId: 'owner-1',
        action: 'status_changed',
        actorType: 'system',
      }),
    );
  });
});
