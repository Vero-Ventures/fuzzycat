import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockCustomersCreate = mock(() =>
  Promise.resolve({ id: 'cus_new_123', email: 'owner@example.com' }),
);

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    customers: { create: mockCustomersCreate },
  }),
}));

const mockSelect = mock();
const mockFrom = mock();
const mockWhere = mock();
const mockLimit = mock();
const mockUpdate = mock();
const mockUpdateSet = mock();
const mockUpdateWhere = mock();
const mockUpdateReturning = mock();

mock.module('@/lib/logger', () => ({
  logger: { info: mock(), warn: mock(), error: mock() },
}));

mock.module('@/server/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

import { schemaMock } from './_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

// Must be imported AFTER mocks are set up
const { getOrCreateCustomer } = await import('@/server/services/stripe/customer');

// ── Tests ────────────────────────────────────────────────────────────

describe('getOrCreateCustomer', () => {
  beforeEach(() => {
    // Chain: db.select().from().where().limit()
    mockLimit.mockResolvedValue([]);
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    // Chain: db.update().set().where().returning()
    mockUpdateReturning.mockResolvedValue([{ stripeCustomerId: 'cus_new_123' }]);
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
  });

  afterEach(() => {
    mockCustomersCreate.mockClear();
    mockSelect.mockClear();
    mockFrom.mockClear();
    mockWhere.mockClear();
    mockLimit.mockClear();
    mockUpdate.mockClear();
    mockUpdateSet.mockClear();
    mockUpdateWhere.mockClear();
    mockUpdateReturning.mockClear();
  });

  it('returns existing customer ID when owner already has one', async () => {
    mockLimit.mockResolvedValue([{ stripeCustomerId: 'cus_existing_456' }]);

    const result = await getOrCreateCustomer({
      clientId: 'client-1',
      email: 'owner@example.com',
      name: 'Jane Doe',
    });

    expect(result).toBe('cus_existing_456');
    expect(mockCustomersCreate).not.toHaveBeenCalled();
  });

  it('creates a new Stripe customer when none exists', async () => {
    mockLimit.mockResolvedValue([{ stripeCustomerId: null }]);

    const result = await getOrCreateCustomer({
      clientId: 'client-1',
      email: 'owner@example.com',
      name: 'Jane Doe',
    });

    expect(result).toBe('cus_new_123');
    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'owner@example.com',
      name: 'Jane Doe',
      metadata: { clientId: 'client-1' },
    });
  });

  it('creates a new Stripe customer when owner has no record', async () => {
    mockLimit.mockResolvedValue([]);

    const result = await getOrCreateCustomer({
      clientId: 'client-1',
      email: 'owner@example.com',
      name: 'Jane Doe',
    });

    expect(result).toBe('cus_new_123');
    expect(mockCustomersCreate).toHaveBeenCalled();
  });

  it('stores the new customer ID in the owners table', async () => {
    mockLimit.mockResolvedValue([{ stripeCustomerId: null }]);

    await getOrCreateCustomer({
      clientId: 'client-1',
      email: 'owner@example.com',
      name: 'Jane Doe',
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith({ stripeCustomerId: 'cus_new_123' });
  });

  it('handles race condition by re-reading existing customer ID', async () => {
    // First select: no existing customer
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () => {
            selectCallCount++;
            if (selectCallCount === 1) {
              // Initial lookup — no customer
              return Promise.resolve([{ stripeCustomerId: null }]);
            }
            // Re-read after race — winner's customer ID
            return Promise.resolve([{ stripeCustomerId: 'cus_winner_789' }]);
          },
        }),
      }),
    }));

    // Conditional update returns empty (another call won the race)
    mockUpdateReturning.mockResolvedValue([]);

    const result = await getOrCreateCustomer({
      clientId: 'client-1',
      email: 'owner@example.com',
      name: 'Jane Doe',
    });

    // Should return the winner's customer ID from the re-read
    expect(result).toBe('cus_winner_789');
    expect(mockCustomersCreate).toHaveBeenCalled();
  });

  it('falls back to orphaned customer ID when re-read returns null', async () => {
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return Promise.resolve([{ stripeCustomerId: null }]);
            }
            // Re-read returns null (edge case)
            return Promise.resolve([{ stripeCustomerId: null }]);
          },
        }),
      }),
    }));

    // Conditional update returns empty (race condition)
    mockUpdateReturning.mockResolvedValue([]);

    const result = await getOrCreateCustomer({
      clientId: 'client-1',
      email: 'owner@example.com',
      name: 'Jane Doe',
    });

    // Falls back to the orphaned customer ID (cus_new_123)
    expect(result).toBe('cus_new_123');
  });

  it('falls back to orphaned customer ID when re-read returns empty', async () => {
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return Promise.resolve([{ stripeCustomerId: null }]);
            }
            // Re-read returns empty (no record found)
            return Promise.resolve([]);
          },
        }),
      }),
    }));

    // Conditional update returns empty (race condition)
    mockUpdateReturning.mockResolvedValue([]);

    const result = await getOrCreateCustomer({
      clientId: 'client-1',
      email: 'owner@example.com',
      name: 'Jane Doe',
    });

    // Falls back to the orphaned customer ID
    expect(result).toBe('cus_new_123');
  });
});
