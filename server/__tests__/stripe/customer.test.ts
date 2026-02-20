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

    // Chain: db.update().set().where()
    mockUpdateWhere.mockResolvedValue([]);
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
  });

  it('returns existing customer ID when owner already has one', async () => {
    mockLimit.mockResolvedValue([{ stripeCustomerId: 'cus_existing_456' }]);

    const result = await getOrCreateCustomer({
      ownerId: 'owner-1',
      email: 'owner@example.com',
      name: 'Jane Doe',
    });

    expect(result).toBe('cus_existing_456');
    expect(mockCustomersCreate).not.toHaveBeenCalled();
  });

  it('creates a new Stripe customer when none exists', async () => {
    mockLimit.mockResolvedValue([{ stripeCustomerId: null }]);

    const result = await getOrCreateCustomer({
      ownerId: 'owner-1',
      email: 'owner@example.com',
      name: 'Jane Doe',
    });

    expect(result).toBe('cus_new_123');
    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'owner@example.com',
      name: 'Jane Doe',
      metadata: { ownerId: 'owner-1' },
    });
  });

  it('creates a new Stripe customer when owner has no record', async () => {
    mockLimit.mockResolvedValue([]);

    const result = await getOrCreateCustomer({
      ownerId: 'owner-1',
      email: 'owner@example.com',
      name: 'Jane Doe',
    });

    expect(result).toBe('cus_new_123');
    expect(mockCustomersCreate).toHaveBeenCalled();
  });

  it('stores the new customer ID in the owners table', async () => {
    mockLimit.mockResolvedValue([{ stripeCustomerId: null }]);

    await getOrCreateCustomer({
      ownerId: 'owner-1',
      email: 'owner@example.com',
      name: 'Jane Doe',
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith({ stripeCustomerId: 'cus_new_123' });
  });
});
